import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

for (const dryRun of [false, true]) {
  test(`local publication ${dryRun ? 'dry run stages without remote mutations' : 'builds and publishes without Actions'}`, () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'renku-local-publish-test-'));
    const log = path.join(root, 'commands.jsonl');
    copyFileSync(new URL('./publish.mjs', import.meta.url), path.join(root, 'publish.mjs'));
    writeFileSync(path.join(root, 'build-local-release.mjs'), `
      import { appendFileSync } from 'node:fs';
      export function buildLocalRelease(tag) {
        appendFileSync(${JSON.stringify(log)}, JSON.stringify({ build: tag }) + '\\n');
        return { artifactRoot: 'local-artifacts', targetIds: ['darwin-arm64', 'darwin-x64', 'win32-x64'] };
      }
    `);
    writeFileSync(path.join(root, 'release-contract.mjs'), `
      import { appendFileSync } from 'node:fs';
      export function assertCleanTree() {}
      export function assertMainBranch() {}
      export function assertOriginMainIsAncestor() {}
      export function assertReleaseTagAtHead() {}
      export function fetchOriginMain() {}
      export function requireCommand() {}
      export function readStudioVersion() { return '0.1.26'; }
      export function runCommand(command, args) {
        appendFileSync(${JSON.stringify(log)}, JSON.stringify({ command, args }) + '\\n');
        return { stdout: 'https://example.test/release', status: 0 };
      }
    `);
    const result = spawnSync(process.execPath, [path.join(root, 'publish.mjs'), ...(dryRun ? ['--dry-run'] : [])],
      { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const calls = readFileSync(log, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    assert.deepEqual(calls[0], { build: 'v0.1.26' });
    const publication = calls.filter(({ command }) => command === 'node');
    assert.deepEqual(publication.map(({ args }) => args[0]), dryRun
      ? ['scripts/release/publish-github-release.mjs', 'scripts/release/publish-r2.mjs']
      : ['scripts/release/publish-github-release.mjs', 'scripts/release/publish-r2.mjs', 'scripts/release/publish-github-release.mjs']);
    assert.ok(publication[0].args.includes('local-artifacts'));
    assert.ok(!calls.some(({ command, args }) => command === 'gh' && ['workflow', 'run'].includes(args[0])));
    if (dryRun) {
      assert.ok(publication.every(({ args }) => args.includes('--dry-run')));
      assert.ok(!calls.some(({ command }) => command === 'git' || command === 'gh'));
    } else {
      assert.deepEqual(calls.filter(({ command }) => command === 'git').map(({ args }) => args),
        [['push', 'origin', 'main'], ['push', 'origin', 'v0.1.26']]);
      assert.ok(publication.at(-1).args.includes('--finalize'));
    }
  });
}
