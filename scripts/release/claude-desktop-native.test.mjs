import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { findClaudeDesktopCli } from '../../distribution/claude-desktop/discovery.mjs';
import { installClaudeDesktopPlugin } from '../../distribution/claude-desktop/plugin.mjs';
import { prepareClaudeMarketplaceCheckout } from '../../distribution/claude-desktop/checkout.mjs';
import { claudeMarketplaceFixture } from './fixtures/claude-marketplace.mjs';

// Opt-in network acceptance. Never use the real user profile or copy credentials.
test('Desktop cached Code installs, updates and loads public Renku commands in a temporary profile', { skip: process.env.RENKU_TEST_CLAUDE_DESKTOP !== '1' }, async (t) => {
  const profile = mkdtempSync(path.join(os.tmpdir(), 'renku-claude-acceptance-'));
  const env = { ...process.env, CLAUDE_CONFIG_DIR: profile };
  const executable = findClaudeDesktopCli({ env });
  assert.ok(executable, 'Native Claude Desktop and its initialized Code runtime are required');
  t.diagnostic(`Temporary profile: ${profile}; Desktop cached CLI: ${executable}`);
  const reports = [];
  const options = { env, marketplaceDirectory: path.join(profile, 'installation', 'plugins', 'claude', 'renku'), report: (message) => reports.push(message) };
  assert.equal(installClaudeDesktopPlugin(options), 0, reports.join('\n'));
  assert.equal(installClaudeDesktopPlugin(options), 0, reports.join('\n'));
  const commands = await loadCommands(executable, env, profile);
  assert.ok(commands.includes('renku:movie-director'));
  t.diagnostic(`Fresh native Code process loaded ${commands.length} Renku commands, including renku:movie-director. No model request or Desktop UI automation was performed.`);
});

test('Desktop cached Code loads an actual new plugin version after the managed checkout updates', { skip: process.env.RENKU_TEST_CLAUDE_DESKTOP !== '1' }, async (t) => {
  const fixture = claudeMarketplaceFixture();
  const env = { ...process.env, CLAUDE_CONFIG_DIR: path.join(fixture.root, 'claude-profile') };
  const executable = findClaudeDesktopCli({ env });
  assert.ok(executable);
  const reports = [];
  const options = {
    env, marketplaceDirectory: fixture.checkout, report: (message) => reports.push(message),
    prepare: (directory, runtime) => prepareClaudeMarketplaceCheckout(directory, { ...runtime, repository: fixture.repository }),
  };
  assert.equal(installClaudeDesktopPlugin(options), 0, reports.join('\n'));
  assert.ok(!(await loadCommands(executable, env, fixture.root)).includes('renku:updated-command'));
  fixture.release('0.2.0', 'updated-command');
  assert.equal(installClaudeDesktopPlugin(options), 0, reports.join('\n'));
  assert.ok((await loadCommands(executable, env, fixture.root)).includes('renku:updated-command'));
  t.diagnostic(`Temporary fixture ${fixture.root}: installed 0.1.0, advanced Git source to 0.2.0, verified installed version and fresh renku:updated-command visibility.`);
});

async function loadCommands(executable, env, profile) {
  const child = spawn(executable, ['--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '-p'], { env, cwd: profile, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  try {
    const initialized = await new Promise((resolve, reject) => {
      let pending = '';
      let stderr = '';
      const timer = setTimeout(() => reject(new Error(`Claude initialization timed out: ${stderr}`)), 30000);
      child.on('error', reject);
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
    child.kill();
  }
}
