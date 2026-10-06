import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { installCodexPlugin } from '../../distribution/install-codex-plugin.mjs';

function fixture({ existing, enabled = true, failure, unavailable = false, verified = true } = {}) {
  const calls = [];
  const records = [];
  const messages = [];
  const plugin = { pluginId: 'renku@renku', installed: true, enabled };
  let lists = 0;
  const run = (args) => {
    calls.push(args);
    if (unavailable) throw Object.assign(new Error('spawn codex ENOENT'), { code: 'ENOENT' });
    if (failure && args[0] === failure.command) throw new Error(failure.message);
    if (args[0] === 'list') {
      lists += 1;
      if (lists > 1 && verified) return { installed: [plugin] };
      return { installed: enabled ? [] : [plugin] };
    }
    if (args[1] === 'list') return { marketplaces: existing ? [{ name: 'renku', marketplaceSource: existing }] : [] };
    return {};
  };
  return { calls, records, messages, options: { run, record: async (value) => records.push(value), report: (message) => messages.push(message) } };
}

test('installs through the public commands and records only verified success', async () => {
  const setup = fixture();
  assert.equal(await installCodexPlugin(setup.options), true);
  assert.deepEqual(setup.records, [false, true]);
  assert.deepEqual(setup.calls.slice(2), [
    ['marketplace', 'add', 'GoRenku/studio-skills', '--ref', 'beta', '--json'],
    ['marketplace', 'upgrade', 'renku', '--json'], ['add', 'renku@renku', '--json'], ['list', '--json'],
  ]);
});

test('updates the existing official marketplace', async () => {
  const setup = fixture({ existing: { sourceType: 'git', source: 'https://github.com/GoRenku/studio-skills.git' } });
  assert.equal(await installCodexPlugin(setup.options), true);
});

for (const options of [
  { unavailable: true },
  { failure: { command: 'list', message: "unrecognized subcommand 'plugin'" } },
  { failure: { command: 'add', message: 'Network unavailable' } },
  { verified: false },
  { enabled: false },
  { existing: { sourceType: 'local', source: '/custom/plugin' } },
]) {
  test(`records false and reports ${JSON.stringify(options)}`, async () => {
    const setup = fixture(options);
    assert.equal(await installCodexPlugin(setup.options), false);
    assert.deepEqual(setup.records, [false]);
    assert.equal(setup.messages.length, 1);
    if (options.enabled === false || options.existing) assert.ok(!setup.calls.some((args) => args[0] === 'add'));
  });
}

test('does not hide a core installation-state write failure', async () => {
  await assert.rejects(installCodexPlugin({ ...fixture().options, record: async () => {
    throw Object.assign(new Error('Cannot write installation state'), { code: 'CONFIG017' });
  } }), { code: 'CONFIG017' });
});

test('the packaged script runs from a resolved temporary path and delegates state to core', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'renku-plugin-entry-'));
  const distribution = path.join(root, 'distribution');
  const core = path.join(root, 'app/node_modules/@gorenku/studio-core/dist/server');
  const commands = path.join(root, 'commands');
  mkdirSync(distribution);
  mkdirSync(core, { recursive: true });
  mkdirSync(commands);
  writeFileSync(path.join(root, 'app/package.json'), '{"type":"module"}');
  writeFileSync(path.join(core, 'index.js'), `
import { writeFileSync } from 'node:fs';
export async function recordCodexPluginInstallation(installed) {
  writeFileSync(process.env.TEST_PLUGIN_STATE, JSON.stringify({ codexPluginInstalled: installed }));
}
`);
  const windows = process.platform === 'win32';
  writeFileSync(path.join(commands, windows ? 'codex.cmd' : 'codex'), windows
    ? '@echo off\nfor %%a in (%*) do if "%%a"=="--help" (echo --json --ref & exit /b 0)\necho Network unavailable 1>&2\nexit /b 1\n'
    : '#!/bin/sh\nfor arg in "$@"; do if [ "$arg" = --help ]; then echo "--json --ref"; exit 0; fi; done\necho "Network unavailable" >&2\nexit 1\n', { mode: 0o755 });
  const script = path.join(distribution, 'install-codex-plugin.mjs');
  copyFileSync(new URL('../../distribution/install-codex-plugin.mjs', import.meta.url), script);
  copyFileSync(new URL('../../distribution/codex-cli.mjs', import.meta.url), path.join(distribution, 'codex-cli.mjs'));
  const state = path.join(root, 'recorded.json');
  const codexHome = path.join(root, 'codex-profile');
  mkdirSync(codexHome);
  const env = { ...process.env, TEST_PLUGIN_STATE: state, CODEX_HOME: codexHome };
  const pathKey = Object.keys(env).find((key) => key.toUpperCase() === 'PATH') || 'PATH';
  env[pathKey] = `${commands}${path.delimiter}${env[pathKey] || ''}`;
  const result = spawnSync(process.execPath, [script], {
    encoding: 'utf8', env,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(readFileSync(state, 'utf8')), { codexPluginInstalled: false });
  assert.match(result.stdout, /Network unavailable/);
});
