#!/usr/bin/env node
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
  const tagIndex = args.indexOf('--tag');
  const tag = tagIndex >= 0 ? args[tagIndex + 1] : undefined;
  if (!tag) {
    throw new Error('RELEASE093 Usage: dispatch-release-workflow.mjs --tag vX.Y.Z');
  }
  for (const command of ['git', 'gh']) {
    requireCommand(command);
  }
  assertMainBranch();
  assertCleanTree();
  fetchOriginMain();
  assertOriginMainIsAncestor();
  assertReleaseTagAtHead(tag);
  runCommand('git', ['push', 'origin', 'main']);
  runCommand('git', ['push', 'origin', tag]);
  runCommand('gh', ['workflow', 'run', 'release.yml', '--ref', tag, '-f', `tag=${tag}`]);
  process.stdout.write(`Dispatched the future full-matrix release workflow for ${tag}.\n`);
} catch (error) {
  process.stderr.write(`[release:dispatch] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
