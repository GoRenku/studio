import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { findClaudeCli } from '../../distribution/claude/discovery.mjs';
import { installClaudePlugin } from '../../distribution/claude/plugin.mjs';
import { prepareClaudeMarketplaceCheckout } from '../../distribution/claude/checkout.mjs';
import { claudeCommand } from '../../distribution/claude/command.mjs';
import { claudeMarketplaceFixture } from './fixtures/claude-marketplace.mjs';

// Opt-in network acceptance. Never use the real user profile or copy credentials.
test('Native Claude Code installs, updates and loads public Renku commands in a temporary profile', { skip: process.env.RENKU_TEST_CLAUDE_DESKTOP !== '1' }, async (t) => {
  const profile = mkdtempSync(path.join(os.tmpdir(), 'renku-claude-acceptance-'));
  const env = { ...process.env, CLAUDE_CONFIG_DIR: profile };
  const executable = findClaudeCli({ env });
  assert.ok(executable, 'A compatible native Claude Code CLI or initialized Desktop Code runtime is required');
  t.diagnostic(`Temporary profile: ${profile}; Selected CLI: ${executable}`);
  const entrypoint = fileURLToPath(new URL('../../distribution/claude/plugin.mjs', import.meta.url));
  const linkedDirectory = path.join(profile, 'linked-distribution');
  symlinkSync(path.dirname(entrypoint), linkedDirectory, process.platform === 'win32' ? 'junction' : 'dir');
  for (const script of [entrypoint, path.join(linkedDirectory, 'plugin.mjs')]) {
    const result = spawnSync(process.execPath, [script, path.join(profile, 'installation', 'plugins', 'claude', 'renku')], { env, encoding: 'utf8', timeout: 240000 });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /Renku Claude plugin is installed/);
  }
  const commands = await loadCommands(executable, env, profile);
  assert.ok(commands.includes('renku:movie-director'));
  t.diagnostic(`Fresh native Code process loaded ${commands.length} Renku commands, including renku:movie-director. No model request or Desktop UI automation was performed.`);
});

test('Native Claude Code loads an actual new plugin version after the managed checkout updates', { skip: process.env.RENKU_TEST_CLAUDE_DESKTOP !== '1' }, async (t) => {
  const fixture = claudeMarketplaceFixture();
  const env = { ...process.env, CLAUDE_CONFIG_DIR: path.join(fixture.root, 'claude-profile') };
  const executable = findClaudeCli({ env });
  assert.ok(executable);
  const reports = [];
  const options = {
    env, marketplaceDirectory: fixture.checkout, report: (message) => reports.push(message),
    prepare: (directory, runtime) => prepareClaudeMarketplaceCheckout(directory, { ...runtime, repository: fixture.repository }),
  };
  assert.equal(installClaudePlugin(options), 0, reports.join('\n'));
  assert.ok(!(await loadCommands(executable, env, fixture.root)).includes('renku:updated-command'));
  fixture.release('0.2.0', 'updated-command');
  assert.equal(installClaudePlugin(options), 0, reports.join('\n'));
  assert.ok((await loadCommands(executable, env, fixture.root)).includes('renku:updated-command'));
  t.diagnostic(`Temporary fixture ${fixture.root}: installed 0.1.0, advanced Git source to 0.2.0, verified installed version and fresh renku:updated-command visibility.`);
});

test('Desktop-only discovery installs and loads the plugin without a terminal CLI', { skip: process.env.RENKU_TEST_CLAUDE_DESKTOP !== '1' }, async (t) => {
  const profile = mkdtempSync(path.join(os.tmpdir(), 'renku-desktop-only-'));
  const env = { ...process.env, CLAUDE_CONFIG_DIR: profile };
  const discoveryEnv = { ...env };
  for (const key of Object.keys(discoveryEnv).filter((key) => key.toUpperCase() === 'PATH')) delete discoveryEnv[key];
  const cacheRoot = process.platform === 'win32'
    ? path.join(process.env.APPDATA, 'Claude', 'claude-code')
    : path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude-code');
  const executable = findClaudeCli({ env: discoveryEnv, home: profile, cacheRoot });
  assert.ok(executable, 'An initialized native Desktop Code runtime is required');
  const reports = [];
  assert.equal(installClaudePlugin({ discover: () => executable, env, marketplaceDirectory: path.join(profile, 'marketplace'), report: (message) => reports.push(message) }), 0, reports.join('\n'));
  assert.ok((await loadCommands(executable, env, profile)).includes('renku:movie-director'));
  t.diagnostic(`Desktop-only runtime ${executable}; temporary profile ${profile}.`);
});

test('Windows command launcher installs and loads Renku in an isolated Claude profile', { skip: process.platform !== 'win32' || process.env.RENKU_TEST_CLAUDE_DESKTOP !== '1' }, async (t) => {
  const fixture = claudeMarketplaceFixture();
  const env = { ...process.env, CLAUDE_CONFIG_DIR: path.join(fixture.root, 'claude-profile') };
  const executable = findClaudeCli({ env });
  assert.ok(executable, 'A compatible Claude CLI is required');
  const directory = path.join(fixture.root, "Claude O'Brien 日本語 $launcher");
  mkdirSync(directory);
  const launcher = path.join(directory, 'claude.cmd');
  env.RENKU_TEST_CLAUDE_TARGET = executable;
  writeFileSync(launcher, '@echo off\r\n"%RENKU_TEST_CLAUDE_TARGET%" %*\r\n');
  const inheritedPath = Object.entries(env).find(([key]) => key.toUpperCase() === 'PATH')?.[1] || '';
  for (const key of Object.keys(env).filter((key) => key.toUpperCase() === 'PATH')) delete env[key];
  env.PATH = `${directory};${inheritedPath}`;
  assert.equal(findClaudeCli({ env }), launcher, 'The test must exercise the command launcher even when a native executable is installed');
  const reports = [];
  assert.equal(installClaudePlugin({
    env, marketplaceDirectory: fixture.checkout, report: (message) => reports.push(message),
    prepare: (checkout, runtime) => prepareClaudeMarketplaceCheckout(checkout, { ...runtime, repository: fixture.repository }),
  }), 0, reports.join('\n'));
  assert.ok((await loadCommands(launcher, env, fixture.root)).includes('renku:movie-director'));
  t.diagnostic(`Command launcher ${launcher}; isolated profile ${env.CLAUDE_CONFIG_DIR}. No model request was submitted.`);
});

async function loadCommands(executable, env, profile) {
  const command = claudeCommand(executable, ['--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '-p'], { env });
  const child = spawn(command.executable, command.args, { env, cwd: profile, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  try {
    const initialized = await new Promise((resolve, reject) => {
      let pending = '';
      let stderr = '';
      const timer = setTimeout(() => reject(new Error(`Claude initialization timed out: ${stderr}`)), 30000);
      child.on('error', (error) => { clearTimeout(timer); reject(error); });
      child.stdin.on('error', (error) => { clearTimeout(timer); reject(error); });
      child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`Claude exited before initialization (${code}): ${stderr}`)); });
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      child.stdout.on('data', (chunk) => {
        pending += chunk;
        let newline;
        while ((newline = pending.indexOf('\n')) !== -1) {
          const line = pending.slice(0, newline);
          pending = pending.slice(newline + 1);
          try {
            const event = JSON.parse(line);
            if (event.type === 'control_response' && event.response?.request_id === 'renku-acceptance') {
              clearTimeout(timer);
              resolve(event.response);
            }
          } catch (error) { clearTimeout(timer); reject(error); }
        }
      });
      child.stdin.write(`${JSON.stringify({ type: 'control_request', request_id: 'renku-acceptance', request: { subtype: 'initialize' } })}\n`);
    });
    assert.equal(initialized.subtype, 'success');
    const commands = initialized.response.commands.map((entry) => entry.name).filter((name) => name.startsWith('renku:'));
    return commands;
  } finally {
    child.stdin.end();
    if (child.pid && child.exitCode === null && child.signalCode === null) {
      await new Promise((resolve) => {
        const timer = setTimeout(() => {
          if (process.platform === 'win32') {
            spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, timeout: 10000, stdio: 'ignore' });
          } else {
            child.kill();
          }
          resolve();
        }, 1000);
        child.once('close', () => { clearTimeout(timer); resolve(); });
      });
    }
  }
}
