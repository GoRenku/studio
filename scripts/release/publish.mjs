#!/usr/bin/env node
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildLocalRelease } from './build-local-release.mjs';
import {
  assertCleanTree,
  assertMainBranch,
  assertOriginMainIsAncestor,
  assertReleaseTagAtHead,
  fetchOriginMain,
  requireCommand,
  runCommand,
} from './release-contract.mjs';

try {
  const args = process.argv.slice(2);
  const tag = readTag(args);
  const dryRun = args.includes('--dry-run');
  for (const command of ['git', 'gh']) {
    requireCommand(command);
  }
  assertMainBranch();
  assertCleanTree();
  fetchOriginMain();
  assertOriginMainIsAncestor();
  assertReleaseTagAtHead(tag);

  const localRelease = buildLocalRelease(tag);
  const publicationRoot = mkdtempSync(path.join(os.tmpdir(), 'renku-local-publish-'));
  const stagingRoot = path.join(publicationRoot, 'github-assets');
  const downloadRoot = path.join(publicationRoot, 'github-release');
  const githubArgs = [
    'scripts/release/publish-github-release.mjs',
    '--tag',
    tag,
    '--release-dir',
    localRelease.artifactRoot,
    '--staging-dir',
    stagingRoot,
    '--download-dir',
    downloadRoot,
    '--targets',
    localRelease.targetIds.join(','),
  ];

  if (dryRun) {
    runCommand('node', [...githubArgs, '--dry-run']);
    runCommand('node', [
      'scripts/release/publish-r2.mjs',
      '--release-dir',
      downloadRoot,
      '--dry-run',
    ]);
    process.stdout.write(
      `Studio local publish dry run passed for ${tag}; no refs or remote release state changed.\n`
    );
  } else {
    runCommand('git', ['push', 'origin', 'main']);
    runCommand('git', ['push', 'origin', tag]);
    runCommand('node', githubArgs);
    runCommand('node', [
      'scripts/release/publish-r2.mjs',
      '--release-dir',
      downloadRoot,
    ]);
    runCommand('node', [
      'scripts/release/publish-github-release.mjs',
      '--tag',
      tag,
      '--finalize',
    ]);
    const release = runCommand(
      'gh',
      ['release', 'view', tag, '--json', 'url', '--jq', '.url'],
      { stdio: 'pipe' }
    );
    process.stdout.write(`Published Studio ${tag} from this machine: ${release.stdout.trim()}\n`);
  }
} catch (error) {
  process.stderr.write(`[release:publish] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}

function readTag(args) {
  const index = args.indexOf('--tag');
  const tag = index >= 0 ? args[index + 1] : undefined;
  if (!tag) {
    throw new Error('RELEASE067 Usage: publish.mjs --tag vX.Y.Z [--dry-run]');
  }
  return tag;
}
