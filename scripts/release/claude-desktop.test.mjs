import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { findClaudeCli } from '../../distribution/claude/discovery.mjs';
import { installClaudePlugin } from '../../distribution/claude/plugin.mjs';
import { claudeCommand } from '../../distribution/claude/command.mjs';

test('script entrypoint reports Desktop absence through a linked installation path', () => {
  const root = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'renku-claude-entry-')));
  const release = path.join(root, 'release');
  mkdirSync(release);
  copyFileSync(new URL('../../distribution/claude/plugin.mjs', import.meta.url), path.join(release, 'plugin.mjs'));
  copyFileSync(new URL('../../distribution/claude/command.mjs', import.meta.url), path.join(release, 'command.mjs'));
  writeFileSync(path.join(release, 'discovery.mjs'), 'export function findClaudeCli() { return null; }\n');
  writeFileSync(path.join(release, 'checkout.mjs'), 'export function prepareClaudeMarketplaceCheckout() { throw new Error("Unexpected checkout"); }\n');
  const current = path.join(root, 'current');
  symlinkSync(release, current, process.platform === 'win32' ? 'junction' : 'dir');
  for (const directory of [release, current]) {
    const result = spawnSync(process.execPath, [path.join(directory, 'plugin.mjs')], { encoding: 'utf8' });
    assert.ifError(result.error);
    assert.equal(result.status, 2, `${directory}: ${result.stdout}${result.stderr}`);
    assert.match(result.stdout, /Checking for Claude Code or Claude Desktop/);
    assert.match(result.stdout, /were not detected/);
  }
});

function discoveryFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'renku-claude-'));
  const apps = path.join(root, 'Üser Applications');
  const cacheRoot = path.join(root, 'Code cache');
  mkdirSync(path.join(apps, 'Renamed Claude.app'), { recursive: true });
  const calls = [];
  const options = {
    platform: 'darwin', home: root, env: { PATH: '' }, applicationDirectories: [apps], cacheRoot,
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

test('absent CLI and Desktop return no installation', () => {
  const { options, calls } = discoveryFixture();
  assert.equal(findClaudeCli({ ...options, applicationDirectories: [] }), null);
  assert.deepEqual(calls, []);
  assert.equal(findClaudeCli({ platform: 'linux' }), null);
});

test('Desktop without initialized Code reports an actionable failure', () => {
  assert.throws(() => findClaudeCli(discoveryFixture().options), /INSTALL013.*Open its Code tab/);
});

test('standalone Claude CLI works without Desktop and is selected once when both exist', () => {
  const { options, cli, calls } = discoveryFixture();
  const directory = path.join(options.home, '.local', 'bin');
  mkdirSync(directory, { recursive: true });
  const executable = path.join(directory, 'claude');
  writeFileSync(executable, '', { mode: 0o755 });
  options.env.PATH = process.platform === 'win32' ? '' : directory;
  assert.equal(findClaudeCli({ ...options, applicationDirectories: [] }), executable);
  cli('2.1.289');
  assert.equal(findClaudeCli(options), executable);
  assert.ok(calls.every(([file]) => file === executable));
});

test('native Claude launcher is found before a new terminal has refreshed PATH', () => {
  const { options } = discoveryFixture();
  const executable = path.join(options.home, '.local', 'bin', 'claude');
  mkdirSync(path.dirname(executable), { recursive: true });
  writeFileSync(executable, '', { mode: 0o755 });
  assert.equal(findClaudeCli({ ...options, applicationDirectories: [] }), executable);
});

test('incompatible terminal CLI reports an error or uses a compatible Desktop runtime', () => {
  const { options, cli } = discoveryFixture();
  const directory = path.join(options.home, '.local', 'bin');
  mkdirSync(directory, { recursive: true });
  const terminal = path.join(directory, 'claude');
  writeFileSync(terminal, '', { mode: 0o755 });
  options.env.PATH = process.platform === 'win32' ? '' : directory;
  const execute = (file, args) => file === terminal ? { status: 1, stderr: 'Unsupported' } : options.execute(file, args);
  assert.throws(() => findClaudeCli({ ...options, applicationDirectories: [], execute }), /INSTALL013.*Update Claude Code/);
  const desktop = cli('2.1.289');
  assert.equal(findClaudeCli({ ...options, execute }), desktop);
});

test('Windows command launchers preserve literal paths and arguments', () => {
  const env = { SystemRoot: 'C:\\Windows' };
  const command = claudeCommand("C:\\Users\\O'Brien\\claude.cmd", ['plugin', 'marketplace', 'add', 'C:\\source $literal'], { env, platform: 'win32' });
  assert.match(command.executable, /powershell\.exe$/);
  const script = Buffer.from(command.args.at(-1), 'base64').toString('utf16le');
  assert.ok(script.includes("'C:\\Users\\O''Brien\\claude.cmd'"));
  assert.ok(script.includes("'C:\\source $literal'"));
});

test('Windows standalone native CLI is found on Path without Desktop', { skip: process.platform !== 'win32' }, () => {
  const home = mkdtempSync(path.join(os.tmpdir(), 'renku-claude-terminal-'));
  const executable = path.join(home, 'claude.exe');
  writeFileSync(executable, '');
  const selected = findClaudeCli({ platform: 'win32', home, env: { Path: home }, execute(file, args) {
    assert.equal(file, executable);
    return { status: 0, stdout: args[0] === '--version' ? '2.1.289 (Claude Code)' : '--json --scope' };
  } });
  assert.equal(selected, executable);
});

test('numeric cache order and stable hash order select a compatible CLI with Unicode paths', () => {
  const { options, cli } = discoveryFixture();
  cli('2.1.9');
  cli('2.1.289', 'z');
  const selected = cli('2.1.289', 'a');
  const incompatible = cli('2.1.300');
  const execute = (file, args) => file === incompatible ? { status: 0, stdout: '2.1.300 (Claude Code)' } : options.execute(file, args);
  assert.equal(findClaudeCli({ ...options, execute }), selected);
});

test('Windows registration query is UTF-8 and preserves malformed registration as a failure', () => {
  const options = { platform: 'win32', execute(file, args) {
    assert.match(file, /powershell\.exe$/);
    assert.match(Buffer.from(args.at(-1), 'base64').toString('utf16le'), /UTF8Encoding/);
    return { status: 0, stdout: 'null' };
  } };
  assert.equal(findClaudeCli(options), null);
  assert.throws(() => findClaudeCli({ ...options, execute: () => ({ status: 0, stdout: '{}' }) }), /INSTALL013.*registration/);
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
  assert.equal(installClaudePlugin({ discover: () => null }), 2);
});

test('fresh installation uses public marketplace and verifies enabled user scope', () => {
  const { options, calls } = pluginFixture();
  assert.equal(installClaudePlugin(options), 0);
  assert.deepEqual(calls, [
    ['list', '--json'], ['marketplace', 'list', '--json'],
    ['marketplace', 'add', options.marketplaceDirectory],
    ['install', 'renku@renku', '--scope', 'user', '--json'], ['list', '--json'],
  ]);
});

test('repeat setup refreshes marketplace and updates the user installation', () => {
  const { options, calls } = pluginFixture({ installed: [{ id: 'renku@renku', scope: 'user', enabled: true }], marketplaces: [{ name: 'renku', source: 'directory', path: path.resolve('/temporary marketplace') }] });
  assert.equal(installClaudePlugin(options), 0);
  assert.deepEqual(calls.slice(2, 4), [['marketplace', 'update', 'renku'], ['update', 'renku@renku', '--scope', 'user', '--json']]);
});

for (const [name, fixture] of Object.entries({
  disabled: { installed: [{ id: 'renku@renku', scope: 'user', enabled: false }] },
  conflict: { marketplaces: [{ name: 'renku', source: 'github', repo: 'someone/else' }] },
})) {
  test(`${name} preserves existing user choices without mutation`, () => {
    const { options, calls, reports } = pluginFixture(fixture);
    assert.equal(installClaudePlugin(options), 1);
    assert.ok(calls.every((args) => args.includes('list')));
    assert.match(reports.at(-1), /INSTALL013/);
  });
}

for (const fixture of [{ failedCommand: 'install' }, { mutation: { outcome: 'failed', message: 'Denied' } }, { verified: [] }, { verified: [{ id: 'renku@renku', scope: 'project', enabled: true }] }, { verified: [{ id: 'renku@renku', scope: 'user', enabled: false }] }, { verified: [{ id: 'renku@renku', scope: 'user', enabled: true, version: '0.0.9' }] }]) {
  test(`failed setup is reported: ${JSON.stringify(fixture)}`, () => {
    const { options, reports } = pluginFixture(fixture);
    assert.equal(installClaudePlugin(options), 1);
    assert.match(reports.at(-1), /^INSTALL013 /);
  });
}
