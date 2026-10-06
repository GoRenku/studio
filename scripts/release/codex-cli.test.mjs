import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createCodexCli } from '../../distribution/codex-cli.mjs';
import { installCodexPlugin } from '../../distribution/install-codex-plugin.mjs';

const success = (stdout = '') => ({ status: 0, stdout, stderr: '' });
const unsupported = { status: 1, stdout: '', stderr: "error: unrecognized subcommand 'plugin'" };
const help = success('Options: --json --ref <REF>');

function macFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'renku-codex-discovery-'));
  const applications = path.join(root, 'Applications');
  const commands = path.join(root, 'commands');
  mkdirSync(applications);
  mkdirSync(commands);
  const env = { PATH: commands, HOME: root, CODEX_HOME: path.join(root, 'custom codex') };
  const desktop = (name, identity = 'com.openai.codex') => {
    const bundle = path.join(applications, name);
    const executable = path.join(bundle, 'Contents/Resources/codex-cli/bin/codex');
    mkdirSync(path.dirname(executable), { recursive: true });
    writeFileSync(executable, '', { mode: 0o755 });
    return { bundle, executable, identity };
  };
  return { root, applications, commands, env, desktop };
}

test('a compatible terminal CLI takes precedence without inspecting Desktop', () => {
  const fixture = macFixture();
  const terminal = path.join(fixture.commands, 'codex');
  writeFileSync(terminal, '', { mode: 0o755 });
  const calls = [];
  const run = createCodexCli({ platform: 'darwin', env: fixture.env, applicationDirectories: [fixture.applications], execute(executable, args, options) {
    calls.push(args);
    assert.equal(executable, terminal);
    assert.equal(options.env, fixture.env);
    assert.notEqual(options.shell, true);
    return args.at(-1) === '--help' ? help : success('{"installed":[]}');
  } });
  assert.deepEqual(run.plugin(['list', '--json']), { installed: [] });
  assert.equal(calls.filter((args) => args.at(-1) === '--help').length, 5);
});

for (const oldTerminal of [false, true]) {
  test(`Mac discovers a renamed Desktop bundle, with old terminal CLI=${oldTerminal}`, () => {
    const fixture = macFixture();
    const desktop = fixture.desktop('My ChatGPT Édition.app');
    fixture.desktop('Other.app', 'com.example.other');
    const terminal = path.join(fixture.commands, 'codex');
    if (oldTerminal) writeFileSync(terminal, '', { mode: 0o755 });
    const calls = [];
    const run = createCodexCli({ platform: 'darwin', env: fixture.env, applicationDirectories: [path.join(fixture.root, 'absent'), fixture.applications], execute(executable, args, options) {
      calls.push({ executable, args });
      assert.equal(options.env, fixture.env);
      if (executable === '/usr/bin/plutil') return success(args.at(-1).startsWith(desktop.bundle) ? desktop.identity : 'com.example.other');
      if (executable === terminal) return unsupported;
      assert.equal(executable, desktop.executable);
      return args.at(-1) === '--help' ? help : success('{}');
    } });
    run.plugin(['add', 'renku@renku', '--json']);
    assert.equal(calls.at(-1).executable, desktop.executable);
    assert.deepEqual(calls.at(-1).args, ['plugin', 'add', 'renku@renku', '--json']);
  });
}

test('absence of both Desktop and terminal CLI reports unavailable without creating a profile', () => {
  const fixture = macFixture();
  assert.throws(() => createCodexCli({ platform: 'darwin', env: fixture.env, applicationDirectories: [fixture.applications], execute() { assert.fail('No executable should run'); } }), { code: 'ENOENT' });
  assert.equal(existsSync(fixture.env.CODEX_HOME), false);
});

test('an unsupported required option prevents plugin mutations', () => {
  const fixture = macFixture();
  const desktop = fixture.desktop('ChatGPT.app');
  assert.throws(() => createCodexCli({ platform: 'darwin', env: fixture.env, applicationDirectories: [fixture.applications], execute(executable, args) {
    if (executable === '/usr/bin/plutil') return success(desktop.identity);
    assert.equal(args.at(-1), '--help');
    return success('Usage: codex plugin');
  } }), { code: 'ENOENT' });
});

test('a runtime installation failure never triggers a second CLI selection', async () => {
  const fixture = macFixture();
  const terminal = path.join(fixture.commands, 'codex');
  writeFileSync(terminal, '', { mode: 0o755 });
  const records = [];
  const messages = [];
  const run = createCodexCli({ platform: 'darwin', env: fixture.env, applicationDirectories: [fixture.applications], execute(executable, args) {
    assert.equal(executable, terminal);
    return args.at(-1) === '--help' ? help : { status: 1, stdout: '', stderr: 'Network unavailable' };
  } });
  assert.equal(await installCodexPlugin({ run: run.plugin, record: async (value) => records.push(value), report: (message) => messages.push(message) }), false);
  assert.deepEqual(records, [false]);
  assert.match(messages[0], /Network unavailable/);
});

function windowsFixture({ terminal, oldTerminal = false, locations = ['C:\\Program Files\\WindowsApps\\OpenAI.Codex_1.0_x64__publisher'], queryError, probeError } = {}) {
  const calls = [];
  const env = { SystemRoot: 'C:\\Windows', PATH: 'C:\\Commands', USERPROFILE: 'C:\\Users\\Élodie', CODEX_HOME: 'D:\\My Codex profile' };
  const execute = (executable, args, options) => {
    assert.equal(options.env, env);
    assert.notEqual(options.shell, true);
    calls.push({ executable, args });
    if (executable.endsWith('powershell.exe')) {
      const source = Buffer.from(args.at(-1), 'base64').toString('utf16le');
      calls.at(-1).source = source;
      if (source.includes('Get-Command')) return success(JSON.stringify(terminal ? [terminal.replace(/\.cmd$/, ''), terminal] : []));
      if (source.includes('Get-AppxPackage')) return queryError || success(JSON.stringify(locations));
      assert.ok(terminal?.endsWith('.cmd'));
      if (oldTerminal) return unsupported;
      return source.includes('--help') ? help : success('{}');
    }
    if (executable === terminal) return oldTerminal ? unsupported : help;
    assert.equal(executable, path.win32.join(locations[0], 'app', 'resources', 'codex.exe'));
    return probeError || (args.at(-1) === '--help' ? help : success('{}'));
  };
  return { calls, options: { platform: 'win32', env, execute } };
}

test('Windows uses the registered package without depending on an extracted hash directory', () => {
  const fixture = windowsFixture();
  const run = createCodexCli(fixture.options);
  assert.deepEqual(run.plugin(['list', '--json']), {});
  const query = fixture.calls.find((call) => call.source?.includes('Get-AppxPackage'));
  assert.match(query.source, /-Name OpenAI\.Codex/);
  assert.doesNotMatch(query.source, /-AllUsers|-AsArray/);
  assert.match(fixture.calls.at(-1).executable, /WindowsApps.*\\app\\resources\\codex\.exe$/);
});

test('Windows preserves npm cmd launchers and quotes their path without shell interpolation', () => {
  const fixture = windowsFixture({ terminal: "C:\\Users\\Élodie's tools & scripts\\codex.cmd" });
  const run = createCodexCli(fixture.options);
  run.plugin(['add', 'renku@renku', '--json']);
  assert.ok(!fixture.calls.some((call) => call.source?.includes('Get-AppxPackage')));
  assert.match(fixture.calls.at(-1).source, /Élodie''s tools & scripts/);
  assert.match(fixture.calls.at(-1).source, /'plugin' 'add' 'renku@renku' '--json'/);
});

test('native Windows finds and runs an npm cmd launcher in a Unicode path', { skip: process.platform !== 'win32' }, () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'renku-codex-unicode-'));
  const commands = path.join(root, "Élodie's tools & scripts");
  mkdirSync(commands);
  writeFileSync(path.join(commands, 'codex'), '#!/bin/sh\nexit 1\n');
  writeFileSync(path.join(commands, 'codex.cmd'), '@echo off\r\nif "%~3"=="--help" goto help\r\nif "%~4"=="--help" goto help\r\necho {"installed":[],"fixture":"unicode-cmd"}\r\nexit /b 0\r\n:help\r\necho --json --ref\r\nexit /b 0\r\n');
  const env = { ...process.env };
  for (const key of Object.keys(env).filter((key) => key.toUpperCase() === 'PATH')) delete env[key];
  env.PATH = commands;
  const run = createCodexCli({ env, execute(executable, args, options) {
    const source = Buffer.from(args.at(-1), 'base64').toString('utf16le');
    assert.doesNotMatch(source, /Get-AppxPackage/);
    return spawnSync(executable, args, options);
  } });
  assert.deepEqual(run.plugin(['list', '--json']), { installed: [], fixture: 'unicode-cmd' });
});

test('Windows with neither installation reports unavailable', () => {
  assert.throws(() => createCodexCli(windowsFixture({ locations: [] }).options), { code: 'ENOENT' });
});

for (const terminal of ['C:\\Commands\\codex.exe', 'C:\\Commands\\codex.cmd']) {
  test(`Windows replaces an unsupported terminal CLI with Desktop: ${terminal}`, () => {
    const fixture = windowsFixture({ terminal, oldTerminal: true });
    createCodexCli(fixture.options).plugin(['list', '--json']);
    assert.match(fixture.calls.at(-1).executable, /WindowsApps.*\\app\\resources\\codex\.exe$/);
  });
}

test('Windows preserves the first compatible native terminal CLI', () => {
  const terminal = 'C:\\Commands\\codex.exe';
  const fixture = windowsFixture({ terminal });
  createCodexCli(fixture.options);
  assert.ok(!fixture.calls.some((call) => call.source?.includes('Get-AppxPackage')));
  assert.equal(fixture.calls.at(-1).executable, terminal);
});

for (const options of [
  { queryError: { status: 1, stdout: '', stderr: 'Access denied' } },
  { probeError: { error: Object.assign(new Error('Access denied'), { code: 'EACCES' }) } },
  { locations: ['relative\\package'] },
]) {
  test(`Windows reports a broken discovery or executable instead of claiming absence: ${JSON.stringify(options)}`, () => {
    assert.throws(() => createCodexCli(windowsFixture(options).options), /INSTALL011/);
  });
}
