import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

export function prepareClaudeMarketplaceCheckout(directory, {
  execute = spawnSync,
  env = process.env,
  repository = 'https://github.com/GoRenku/studio-skills.git',
} = {}) {
  if (!directory || !path.isAbsolute(directory)) throw new Error('Claude marketplace directory must be an absolute path inside the Renku installation.');
  const git = (args) => {
    const result = execute('git', args, { encoding: 'utf8', timeout: 180000, env: { ...env, GIT_TERMINAL_PROMPT: '0' }, windowsHide: true });
    if (result.error || result.status !== 0) throw new Error(`Cannot prepare Claude marketplace at ${directory}: git ${args[0]} failed: ${result.error?.message || result.stderr || result.stdout || `exit ${result.status}`}`);
    return result.stdout.trim();
  };
  if (!existsSync(directory)) {
    mkdirSync(path.dirname(directory), { recursive: true });
    git(['clone', '--', repository, directory]);
  } else {
    if (!existsSync(path.join(directory, '.git'))) throw new Error(`Claude marketplace path ${directory} is not a Git checkout. Existing files were preserved.`);
    const root = git(['-C', directory, 'rev-parse', '--show-toplevel']);
    if (realpathSync(root) !== realpathSync(directory)) throw new Error(`Claude marketplace path ${directory} is not the checkout root. Existing files were preserved.`);
    if (git(['-C', directory, 'remote', 'get-url', 'origin']) !== repository) throw new Error(`Claude marketplace checkout ${directory} has a different origin. Existing files were preserved.`);
    if (git(['-C', directory, 'status', '--porcelain'])) throw new Error(`Claude marketplace checkout ${directory} has local changes. Preserve or resolve them before rerunning setup.`);
    git(['-C', directory, 'fetch', 'origin', 'HEAD']);
    // Refuse local commits, including an ahead-only checkout; never reset user work.
    if (git(['-C', directory, 'rev-list', '--max-count=1', 'HEAD', '--not', 'FETCH_HEAD'])) throw new Error(`Claude marketplace checkout ${directory} has commits outside the remote default branch. Preserve or resolve them before rerunning setup.`);
    git(['-C', directory, 'merge', '--ff-only', 'FETCH_HEAD']);
  }
  const manifest = JSON.parse(readFileSync(path.join(directory, '.claude-plugin', 'plugin.json'), 'utf8'));
  if (manifest.name !== 'renku' || typeof manifest.version !== 'string' || !manifest.version) throw new Error(`Claude marketplace checkout ${directory} is missing the versioned Renku plugin manifest.`);
  return { directory: realpathSync(directory), version: manifest.version };
}
