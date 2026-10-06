import { readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCodexCli } from './codex-cli.mjs';
import { openCodexAppServer } from './codex-app-server.mjs';

const pluginId = 'renku@renku';

function installedRenkuSkills(home, env) {
  const lockPath = env.XDG_STATE_HOME
    ? path.join(env.XDG_STATE_HOME, 'skills', '.skill-lock.json')
    : path.join(home, '.agents', '.skill-lock.json');
  let lock;
  try {
    lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return new Set();
    throw new Error(`INSTALL012 Cannot read the skills installer record at ${lockPath}: ${error.message}`);
  }
  if (lock.version !== 3 || !lock.skills || typeof lock.skills !== 'object' || Array.isArray(lock.skills)) {
    throw new Error(`INSTALL012 Invalid skills installer record at ${lockPath}. Rerun skills installation.`);
  }
  return new Set(Object.entries(lock.skills).filter(([, entry]) => entry?.source === 'GoRenku/studio-skills' && entry.sourceType === 'github').map(([name]) => name));
}

function pluginIsReady(cli) {
  const plugin = cli.plugin(['list', '--json']).installed.find((entry) => entry.pluginId === pluginId);
  if (!plugin || plugin.installed !== true || plugin.enabled !== true) return false;
  const marketplace = cli.plugin(['marketplace', 'list', '--json']).marketplaces.find((entry) => entry.name === 'renku');
  return marketplace?.marketplaceSource?.sourceType === 'git' && marketplace.marketplaceSource.source === 'https://github.com/GoRenku/studio-skills.git';
}

async function listSkills(server, home) {
  const result = await server.request('skills/list', { cwds: [home], forceReload: true });
  const entry = result?.data?.[0];
  if (result?.data?.length !== 1 || !Array.isArray(entry?.skills) || !Array.isArray(entry.errors) || entry.errors.length) {
    throw new Error('INSTALL012 Codex could not provide a complete skills inventory. Fix skill loading errors and rerun the installer.');
  }
  return entry.skills;
}

function duplicates(skills, installed, home, env) {
  const pluginSkills = skills.filter((skill) => skill.pluginId === pluginId && skill.enabled === true);
  if (!pluginSkills.length) throw new Error('INSTALL012 Renku is installed, but Codex did not load its plugin skills. Standalone skills were left unchanged.');
  const names = new Set(pluginSkills.map((skill) => {
    if (!skill.name.startsWith('renku:')) throw new Error('INSTALL012 Codex returned an invalid Renku plugin skill identity.');
    return skill.name.slice('renku:'.length);
  }));
  const roots = [path.join(home, '.agents', 'skills'), path.join(env.CODEX_HOME || path.join(home, '.codex'), 'skills')];
  const paths = new Set();
  for (const name of installed) {
    if (!names.has(name) || name !== path.basename(name) || name === '.' || name === '..') continue;
    for (const root of roots) {
      try {
        paths.add(realpathSync(path.join(root, name, 'SKILL.md')));
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
  }
  const pluginPaths = new Set(skills.filter((skill) => skill.pluginId != null).map((skill) => skill.path));
  const candidates = skills.filter((skill) => skill.pluginId == null && skill.scope === 'user' && skill.enabled === true && names.has(skill.name) && paths.has(skill.path) && !pluginPaths.has(skill.path));
  return [...new Map(candidates.map((skill) => [skill.path, skill])).values()];
}

async function disableDuplicates(cli, home, env, installed) {
  const server = await openCodexAppServer(() => cli.startAppServer(home));
  try {
    const candidates = duplicates(await listSkills(server, home), installed, home, env);
    for (const skill of candidates) {
      const result = await server.request('skills/config/write', { path: skill.path, enabled: false });
      if (result?.effectiveEnabled !== false) throw new Error(`INSTALL012 Codex did not disable the standalone skill at ${skill.path}.`);
    }
    if (candidates.length) {
      const verified = await listSkills(server, home);
      if (candidates.some((skill) => !verified.some((entry) => entry.path === skill.path && entry.enabled === false))) {
        throw new Error('INSTALL012 Codex did not verify the standalone skill exclusions. Rerun the installer.');
      }
      if (candidates.some((skill) => !verified.some((entry) => entry.pluginId === pluginId && entry.name === `renku:${skill.name}` && entry.enabled === true))) {
        throw new Error('INSTALL012 Codex no longer reports active Renku plugin skills.');
      }
    }
    return candidates.length;
  } finally {
    await server.close();
  }
}

export async function reconcileCodexSkills({ cli, home = homedir(), env = process.env, report = console.log } = {}) {
  const installed = installedRenkuSkills(home, env);
  if (!installed.size) return 0;
  try {
    cli ??= createCodexCli({ env });
  } catch (error) {
    if (error.code === 'ENOENT') return 0;
    throw error;
  }
  if (!pluginIsReady(cli)) return 0;
  const count = await disableDuplicates(cli, home, env, installed);
  report(`Codex uses the Renku plugin; disabled ${count} duplicate standalone skill(s) in Codex. Skill files remain available to other agents. Restart Codex Desktop to reload skills.`);
  return count;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  reconcileCodexSkills().catch((error) => {
    console.error(`INSTALL012 Codex skill reconciliation failed: ${error.message}`);
    process.exitCode = 1;
  });
}
