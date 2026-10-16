import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { composeReleaseNotes } from './release-notes.mjs';

test('release notes group commit subjects since the previous annotated tag', () => {
  const root = createRepository();
  commit(root, 'release: v1.0.0');
  runGit(root, ['tag', '-a', 'v1.0.0', '-m', 'release: v1.0.0']);
  commit(root, 'feat: add the storyboard panel');
  commit(root, 'fix(cli): report missing projects');
  runGit(root, ['tag', 'v1.0.1-local']);
  commit(root, 'chore: tidy scripts');
  commit(root, 'feat!: rename scenes');
  commit(root, 'tighten installer wording');
  runGit(root, ['checkout', '-q', '-b', 'side']);
  commit(root, 'fix: side branch repair');
  runGit(root, ['checkout', '-q', 'main']);
  runGit(root, ['merge', '-q', '--no-ff', 'side', '-m', 'Merge branch side']);
  commit(root, 'release: v1.1.0');
  runGit(root, ['tag', '-a', 'v1.1.0', '-m', 'release: v1.1.0']);

  assert.equal(
    composeReleaseNotes({ tag: 'v1.1.0', root }),
    [
      'Renku Studio beta · [Install](https://gorenku.com/download/?utm_source=github&utm_medium=referral&utm_campaign=always-on&utm_content=release-notes) · Update an existing installation with `renku update`',
      '',
      '### Features',
      '- Add the storyboard panel',
      '- Rename scenes',
      '',
      '### Fixes',
      '- Report missing projects',
      '- Side branch repair',
      '',
      '### Other changes',
      '- Tidy scripts',
      '- Tighten installer wording',
      '',
      '**Full changelog**: https://github.com/GoRenku/studio/compare/v1.0.0...v1.1.0',
      '',
    ].join('\n')
  );
});

test('release notes leave out empty sections', () => {
  const root = createRepository();
  commit(root, 'release: v1.0.0');
  runGit(root, ['tag', '-a', 'v1.0.0', '-m', 'release: v1.0.0']);
  commit(root, 'release: v1.0.1');
  runGit(root, ['tag', '-a', 'v1.0.1', '-m', 'release: v1.0.1']);

  const notes = composeReleaseNotes({ tag: 'v1.0.1', root });
  assert.doesNotMatch(notes, /###/);
  assert.match(notes, /compare\/v1\.0\.0\.\.\.v1\.0\.1/);
});

test('release notes fail without an earlier annotated release tag', () => {
  const root = createRepository();
  commit(root, 'feat: first');
  runGit(root, ['tag', 'v0.9.0']);
  commit(root, 'release: v1.0.0');
  runGit(root, ['tag', '-a', 'v1.0.0', '-m', 'release: v1.0.0']);
  assert.throws(() => composeReleaseNotes({ tag: 'v1.0.0', root }), /RELEASE055/);
});

function createRepository() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'renku-release-notes-'));
  runGit(root, ['init', '-q', '-b', 'main']);
  runGit(root, ['config', 'user.email', 'release-test@gorenku.com']);
  runGit(root, ['config', 'user.name', 'Renku Release Test']);
  return root;
}

let commitCount = 0;

function commit(root, subject) {
  commitCount += 1;
  writeFileSync(path.join(root, `change-${commitCount}.txt`), subject);
  runGit(root, ['add', '.']);
  runGit(root, ['commit', '-q', '-m', subject]);
}

function runGit(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
}
