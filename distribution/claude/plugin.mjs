import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { existsSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { findClaudeCli } from './discovery.mjs';
import { prepareClaudeMarketplaceCheckout } from './checkout.mjs';
import { claudeCommand } from './command.mjs';

const pluginId = 'renku@renku';

function invoke(executable, args, { execute, env }) {
  const command = claudeCommand(executable, ['plugin', ...args], { env });
  const result = execute(command.executable, command.args, { encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024, env, windowsHide: true });
  if (result.error || result.status !== 0) throw new Error(`claude plugin ${args.join(' ')} failed: ${result.error?.message || result.stderr || result.stdout || `exit ${result.status}`}`);
  return result.stdout.trim();
}

function inventory(run, args) {
  const entries = JSON.parse(run([...args, '--json']));
  if (!Array.isArray(entries)) throw new Error(`claude plugin ${args.join(' ')} returned an invalid inventory.`);
  return entries;
}

function sameMarketplace(entry, directory) {
  if (entry.source !== 'directory' || typeof entry.path !== 'string' || !path.isAbsolute(entry.path)) return false;
  const canonical = (value) => existsSync(value) ? realpathSync(value) : path.resolve(value);
  return canonical(entry.path) === canonical(directory);
}

export function installClaudePlugin({ marketplaceDirectory, discover = findClaudeCli, prepare = prepareClaudeMarketplaceCheckout, execute = spawnSync, env = process.env, report = console.log } = {}) {
  try {
    report('Checking for Claude Code or Claude Desktop.');
    const executable = discover({ env, execute });
    if (!executable) {
      report('Claude Code and Claude Desktop were not detected. Skipping Claude plugin setup.');
      return 2;
    }
    report('Claude detected. Setting up the Renku plugin.');
    if (!marketplaceDirectory || !path.isAbsolute(marketplaceDirectory)) throw new Error('Claude setup requires an absolute marketplace directory inside the Renku installation.');
    const run = (args) => invoke(executable, args, { execute, env });
    const installed = inventory(run, ['list']).filter((entry) => entry.id === pluginId);
    if (installed.some((entry) => entry.enabled === false)) throw new Error('Renku is explicitly disabled in Claude. Enable it in Claude before rerunning setup; your selection was preserved.');
    const marketplace = inventory(run, ['marketplace', 'list']).find((entry) => entry.name === 'renku');
    if (marketplace && !sameMarketplace(marketplace, marketplaceDirectory)) throw new Error('Claude marketplace "renku" uses a different source. Resolve that name conflict in Claude and rerun setup; its source was preserved.');
    const checkout = prepare(marketplaceDirectory, { env, execute });
    run(marketplace ? ['marketplace', 'update', 'renku'] : ['marketplace', 'add', checkout.directory]);
    const action = installed.some((entry) => entry.scope === 'user') ? 'update' : 'install';
    const result = JSON.parse(run([action, pluginId, '--scope', 'user', '--json']).split(/\r?\n/).at(-1));
    if (result.outcome !== 'ok') throw new Error(`Claude plugin ${action} did not succeed: ${result.message || result.failureCode || 'unexpected result'}`);
    const verified = inventory(run, ['list']).find((entry) => entry.id === pluginId && entry.scope === 'user');
    if (!verified || verified.enabled !== true) throw new Error('Claude did not report an enabled user-scope renku@renku plugin after setup.');
    if (verified.version !== checkout.version) throw new Error(`Claude reported Renku plugin version ${verified.version}; expected ${checkout.version} from the updated marketplace.`);
    report('Renku Claude plugin is installed. Start a new Claude Code CLI or local Desktop Code session to use /renku:movie-director.');
    return 0;
  } catch (error) {
    report(`${error.message.startsWith('INSTALL013') ? '' : 'INSTALL013 '}${error.message}`);
    return 1;
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = installClaudePlugin({ marketplaceDirectory: process.argv[2] });
}
