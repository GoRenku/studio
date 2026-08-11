#!/usr/bin/env node
import { bumpSemver, readStudioVersion, runCommand } from './release-contract.mjs';

try {
  const args = process.argv.slice(2).filter((argument) => argument !== '--');
  const dryRun = args.includes('--dry-run');
  const bumpType = args.find((argument) => argument !== '--dry-run') ?? 'patch';
  if (!['patch', 'minor', 'major'].includes(bumpType)) {
    throw new Error(`RELEASE066 Use patch, minor, or major; received ${bumpType}.`);
  }
  if (dryRun) {
    runCommand('node', ['scripts/release/preflight.mjs']);
    const nextVersion = bumpSemver(readStudioVersion(), bumpType);
    process.stdout.write(`Studio release dry run passed. Next tag would be v${nextVersion}.\n`);
  } else {
    runCommand('node', ['scripts/release/prepare.mjs', bumpType]);
    const tag = `v${readStudioVersion()}`;
    runCommand('node', ['scripts/release/publish.mjs', '--tag', tag]);
  }
} catch (error) {
  process.stderr.write(`[release:ship] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
