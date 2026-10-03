import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const marketplace = 'renku';
const pluginId = 'renku@renku';

function command(args) {
  if (process.platform === 'win32' && spawnSync('where.exe', ['codex'], { encoding: 'utf8' }).status !== 0) {
    throw Object.assign(new Error('Codex CLI is absent.'), { code: 'ENOENT' });
  }
  const result = spawnSync('codex', ['plugin', ...args], {
    encoding: 'utf8', timeout: 120000, shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`INSTALL011 codex plugin ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout);
}

function assertMarketplace(source) {
  if (!source || source.sourceType !== 'git' || source.source !== 'https://github.com/GoRenku/studio-skills.git') {
    throw new Error('INSTALL011 The Renku marketplace uses a different source. Keep your chosen source; resolve the marketplace conflict before retrying.');
  }
}

function assertEnabled(plugin) {
  if (plugin && plugin.enabled === false) {
    throw new Error('INSTALL011 Renku is disabled in Codex. Enable it explicitly in Codex before retrying.');
  }
}

export async function installCodexPlugin({ run = command, record, report = console.log }) {
  await record(false);
  try {
    const plugins = run(['list', '--json']);
    assertEnabled(plugins.installed.find((plugin) => plugin.pluginId === pluginId));
    const sources = run(['marketplace', 'list', '--json']);
    const existing = sources.marketplaces.find((entry) => entry.name === marketplace);
    if (existing) assertMarketplace(existing.marketplaceSource);
    run(['marketplace', 'add', 'GoRenku/studio-skills', '--ref', 'beta', '--json']);
    run(['marketplace', 'upgrade', marketplace, '--json']);
    run(['add', pluginId, '--json']);
    const installed = run(['list', '--json']).installed.find((plugin) => plugin.pluginId === pluginId);
    assertEnabled(installed);
    if (!installed || installed.installed !== true || installed.enabled !== true) {
      throw new Error('INSTALL011 Codex did not verify Renku as installed and enabled.');
    }
    await record(true);
    report('Renku Codex plugin installed and enabled. Restart Codex Desktop to load it.');
    return true;
  } catch (error) {
    if (error.code === 'CONFIG017') throw error;
    if (error.code === 'ENOENT' || /unrecognized subcommand ['"](?:plugin|marketplace|list|add|upgrade)['"]/.test(error.message)) {
      report('Codex CLI is absent or does not support plugins; plugin installation skipped.');
    } else {
      report(`Renku Codex plugin was not installed: ${error.message}`);
    }
    return false;
  }
}

async function main() {
  const core = await import('../app/node_modules/@gorenku/studio-core/dist/server/index.js');
  await installCodexPlugin({ record: core.recordCodexPluginInstallation });
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`${error.code ?? 'INSTALL011'} ${error.message}`);
    process.exitCode = 1;
  });
}
