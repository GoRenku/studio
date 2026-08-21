#!/usr/bin/env node
import {
  STUDIO_VERSION_MANIFESTS,
  assertCleanTree,
  assertHeadEqualsOriginMain,
  assertMainBranch,
  assertTagMissing,
  bumpSemver,
  fetchOriginMain,
  readStudioVersion,
  requireCommand,
  runCommand,
  writeStudioVersion,
} from './release-contract.mjs';

try {
  const bumpType = process.argv.slice(2).find((argument) => argument !== '--') ?? 'patch';
  if (!['patch', 'minor', 'major'].includes(bumpType)) {
    throw new Error(`RELEASE066 Use patch, minor, or major; received ${bumpType}.`);
  }
  requireCommand('git');
  requireCommand('pnpm');
  assertMainBranch();
  assertCleanTree();
  fetchOriginMain();
  assertHeadEqualsOriginMain();

  const currentVersion = readStudioVersion();
  const nextVersion = bumpSemver(currentVersion, bumpType);
  const tag = `v${nextVersion}`;
  assertTagMissing(tag);

  writeStudioVersion(nextVersion);
  runCommand('pnpm', ['check']);
  runCommand('git', ['add', ...STUDIO_VERSION_MANIFESTS]);
  runCommand('git', ['commit', '-m', `release: ${tag}`]);
  runCommand('git', ['tag', '-a', tag, '-m', `release: ${tag}`]);

  process.stdout.write(`Prepared Studio ${tag}.\n`);
  process.stdout.write('Next: pnpm release:publish\n');
} catch (error) {
  process.stderr.write(`[release:prepare] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
