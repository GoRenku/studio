#!/usr/bin/env node
import { assertLocalReleaseToolchain } from './build-local-release.mjs';
import {
  assertCleanTree,
  assertHeadEqualsOriginMain,
  assertMainBranch,
  fetchOriginMain,
  readStudioVersion,
  requireCommand,
  runCommand,
} from './release-contract.mjs';

try {
  for (const command of ['git', 'gh', 'node', 'pnpm']) {
    requireCommand(command);
  }
  assertMainBranch();
  assertCleanTree();
  fetchOriginMain();
  assertHeadEqualsOriginMain();
  const version = readStudioVersion();
  const target = assertLocalReleaseToolchain();
  runCommand('pnpm', ['test:release']);
  runCommand('pnpm', ['check']);
  process.stdout.write(
    `Studio local release preflight passed at ${version}; ${target.id} will receive runtime verification and all declared targets will be packaged.\n`
  );
} catch (error) {
  process.stderr.write(`[release:preflight] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
