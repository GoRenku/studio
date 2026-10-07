import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function claudeMarketplaceFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'renku-marketplace-fixture-'));
  const repository = path.join(root, 'remote');
  const checkout = path.join(root, 'installation with spaces', 'plugins', 'claude', 'renku');
  mkdirSync(repository);
  const git = (args, cwd = repository) => execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true }).trim();
  git(['init', '--initial-branch=main']);
  const write = (file, content) => {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
  };
  write(path.join(repository, '.claude-plugin', 'marketplace.json'), { name: 'renku', owner: { name: 'Renku test' }, plugins: [{ name: 'renku', source: './' }] });
  const release = (version, command) => {
    write(path.join(repository, '.claude-plugin', 'plugin.json'), { name: 'renku', version, description: 'Temporary native acceptance fixture.' });
    write(path.join(repository, 'skills', command, 'SKILL.md'), `---\nname: ${command}\ndescription: Temporary acceptance skill ${version}.\n---\nReport the fixture version ${version}.\n`);
    git(['add', '.']);
    git(['-c', 'user.name=Renku Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', `Fixture ${version}`]);
  };
  release('0.1.0', 'movie-director');
  return { root, repository, checkout, release, git };
}
