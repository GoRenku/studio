import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createCodexCli } from '../../distribution/codex-cli.mjs';
import { openCodexAppServer } from './fixtures/native-codex-app-server.mjs';
import { installCodexPlugin } from '../../distribution/install-codex-plugin.mjs';

test('public Renku marketplace installs and updates through the installer', { skip: !process.env.RENKU_TEST_CODEX_EXECUTABLE || process.env.RENKU_TEST_CODEX_PUBLIC_MARKETPLACE !== '1' }, async () => {
  const home = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'renku-public-plugin-')));
  const env = { ...process.env, CODEX_HOME: home };
  for (const key of Object.keys(env).filter((key) => key.toUpperCase() === 'PATH')) delete env[key];
  env.PATH = `${path.dirname(process.env.RENKU_TEST_CODEX_EXECUTABLE)}${path.delimiter}${process.env.PATH || ''}`;
  const cli = createCodexCli({ env });
  const records = [];
  const reports = [];
  const options = { run: cli.plugin, record: async (installed) => records.push(installed), report: (message) => reports.push(message) };
  assert.equal(await installCodexPlugin(options), true, reports.join('\n'));
  assert.equal(await installCodexPlugin(options), true, reports.join('\n'));
  assert.deepEqual(records, [false, true, false, true]);
  const server = await openCodexAppServer(() => cli.startAppServer(home));
  try {
    const { data } = await server.request('skills/list', { cwds: [home], forceReload: true });
    assert.deepEqual(data[0].errors, []);
    assert.ok(data[0].skills.some((entry) => entry.pluginId === 'renku@renku' && entry.name === 'renku:movie-director' && entry.enabled));
  } finally {
    await server.close();
  }
});
