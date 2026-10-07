import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { findClaudeDesktopCli } from '../../distribution/claude-desktop/discovery.mjs';
import { installClaudeDesktopPlugin } from '../../distribution/claude-desktop/plugin.mjs';

function discoveryFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'renku-claude-'));
  const apps = path.join(root, 'Üser Applications');
  const cacheRoot = path.join(root, 'Code cache');
  mkdirSync(path.join(apps, 'Renamed Claude.app'), { recursive: true });
  const calls = [];
  const options = {
    platform: 'darwin', applicationDirectories: [apps], cacheRoot,
    execute(executable, args) {
      calls.push([executable, ...args]);
      return { status: 0, stdout: executable === '/usr/bin/plutil' ? 'com.anthropic.claudefordesktop' : args[0] === '--version' ? '2.1.289 (Claude Code)' : '--json --scope' };
    },
  };
  function cli(version, hash = 'hash') {
    const file = path.join(cacheRoot, version, hash, 'claude.app', 'Contents', 'MacOS', 'claude');
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, '', { mode: 0o755 });
    return file;
  }
  return { options, cli, calls };
}

test('Desktop absence does not consult the runtime or PATH', () => {
  const { options, calls } = discoveryFixture();
  assert.equal(findClaudeDesktopCli({ ...options, applicationDirectories: [] }), null);
  assert.deepEqual(calls, []);
  assert.equal(findClaudeDesktopCli({ platform: 'linux' }), null);
});

test('Desktop without initialized Code reports an actionable failure', () => {
  assert.throws(() => findClaudeDesktopCli(discoveryFixture().options), /INSTALL013.*Open its Code tab/);
});

test('numeric cache order and stable hash order select a compatible CLI with Unicode paths', () => {
  const { options, cli } = discoveryFixture();
  cli('2.1.9');
  cli('2.1.289', 'z');
  const selected = cli('2.1.289', 'a');
  const incompatible = cli('2.1.300');
  const execute = (file, args) => file === incompatible ? { status: 0, stdout: '2.1.300 (Claude Code)' } : options.execute(file, args);
  assert.equal(findClaudeDesktopCli({ ...options, execute }), selected);
});

test('Windows registration query is UTF-8 and preserves malformed registration as a failure', () => {
  const options = { platform: 'win32', execute(file, args) {
    assert.match(file, /powershell\.exe$/);
    assert.match(Buffer.from(args.at(-1), 'base64').toString('utf16le'), /UTF8Encoding/);
    return { status: 0, stdout: 'null' };
  } };
  assert.equal(findClaudeDesktopCli(options), null);
  assert.throws(() => findClaudeDesktopCli({ ...options, execute: () => ({ status: 0, stdout: '{}' }) }), /INSTALL013.*registration/);
});

function pluginFixture({ installed = [], marketplaces = [], mutation = { outcome: 'ok' }, verified = [{ id: 'renku@renku', scope: 'user', enabled: true, version: '0.1.0' }], failedCommand } = {}) {
  const calls = [];
  const reports = [];
  let lists = 0;
  const env = { CLAUDE_CONFIG_DIR: '/temporary profile' };
  const options = {
    marketplaceDirectory: path.resolve('/temporary marketplace'),
    prepare: (directory) => ({ directory, version: '0.1.0' }),
    discover: () => '/native cache/claude', env, report: (message) => reports.push(message),
    execute(file, args, settings) {
      assert.equal(file, '/native cache/claude');
      assert.equal(settings.env, env);
      calls.push(args.slice(1));
      if (args[1] === failedCommand) return { status: 1, stderr: 'network failure' };
      let stdout = '';
      if (args[1] === 'list') stdout = JSON.stringify(lists++ === 0 ? installed : verified);
      else if (args[1] === 'marketplace' && args[2] === 'list') stdout = JSON.stringify(marketplaces);
      else if (['install', 'update'].includes(args[1])) stdout = `Progress output\n${JSON.stringify(mutation)}\n`;
      return { status: 0, stdout };
    },
  };
  return { options, calls, reports };
}

test('absent Desktop returns the distinct skip status', () => {
  assert.equal(installClaudeDesktopPlugin({ discover: () => null }), 2);
});

test('fresh installation uses public marketplace and verifies enabled user scope', () => {
  const { options, calls } = pluginFixture();
  assert.equal(installClaudeDesktopPlugin(options), 0);
  assert.deepEqual(calls, [
    ['list', '--json'], ['marketplace', 'list', '--json'],
    ['marketplace', 'add', options.marketplaceDirectory],
    ['install', 'renku@renku', '--scope', 'user', '--json'], ['list', '--json'],
  ]);
});

test('repeat setup refreshes marketplace and updates the user installation', () => {
  const { options, calls } = pluginFixture({ installed: [{ id: 'renku@renku', scope: 'user', enabled: true }], marketplaces: [{ name: 'renku', source: 'directory', path: path.resolve('/temporary marketplace') }] });
  assert.equal(installClaudeDesktopPlugin(options), 0);
  assert.deepEqual(calls.slice(2, 4), [['marketplace', 'update', 'renku'], ['update', 'renku@renku', '--scope', 'user', '--json']]);
});

for (const [name, fixture] of Object.entries({
  disabled: { installed: [{ id: 'renku@renku', scope: 'user', enabled: false }] },
  conflict: { marketplaces: [{ name: 'renku', source: 'github', repo: 'someone/else' }] },
})) {
  test(`${name} preserves existing user choices without mutation`, () => {
    const { options, calls, reports } = pluginFixture(fixture);
    assert.equal(installClaudeDesktopPlugin(options), 1);
    assert.ok(calls.every((args) => args.includes('list')));
    assert.match(reports[0], /INSTALL013/);
  });
}

for (const fixture of [{ failedCommand: 'install' }, { mutation: { outcome: 'failed', message: 'Denied' } }, { verified: [] }, { verified: [{ id: 'renku@renku', scope: 'project', enabled: true }] }, { verified: [{ id: 'renku@renku', scope: 'user', enabled: false }] }, { verified: [{ id: 'renku@renku', scope: 'user', enabled: true, version: '0.0.9' }] }]) {
  test(`failed setup is reported: ${JSON.stringify(fixture)}`, () => {
    const { options, reports } = pluginFixture(fixture);
    assert.equal(installClaudeDesktopPlugin(options), 1);
    assert.match(reports[0], /^INSTALL013 /);
  });
}
