#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  parseReleaseTag,
  readStudioVersion,
  repositoryRoot,
  requireCommand,
  runCommand,
} from './release-contract.mjs';
import {
  BUNDLED_NODE_VERSION,
  RELEASE_TARGETS,
  isHostReleaseTarget,
  requireHostReleaseTarget,
  targetNodeExecutable,
} from './release-targets.mjs';

export function localReleasePaths(tag) {
  const root = path.join(repositoryRoot, 'release', 'local', tag);
  return {
    root,
    artifactRoot: path.join(root, 'artifacts'),
    stagingRoot: path.join(root, 'staging'),
    runtimeRoot: path.join(root, 'runtime'),
  };
}

export function buildLocalRelease(tag) {
  const version = parseReleaseTag(tag);
  if (readStudioVersion() !== version) {
    throw new Error(`RELEASE089 Tag ${tag} does not match the checked-in Studio version.`);
  }
  const target = assertLocalReleaseToolchain();
  const paths = localReleasePaths(tag);
  mkdirSync(paths.root, { recursive: true });
  runWithNode('24', ['pnpm', 'build']);
  for (const releaseTarget of RELEASE_TARGETS) {
    const privateNodeRoot = requirePrivateNodeRuntime(
      releaseTarget,
      path.join(paths.runtimeRoot, releaseTarget.id)
    );
    const assembleArgs = [
      'node',
      'scripts/release/assemble-product.mjs',
      '--target',
      releaseTarget.id,
      '--output',
      paths.stagingRoot,
      '--bundled-node-dir',
      privateNodeRoot,
    ];
    runWithNode('24', assembleArgs);

    const productParent = path.join(
      paths.stagingRoot,
      `renku-${version}-${releaseTarget.id}`
    );
    const artifactDirectory = path.join(paths.artifactRoot, releaseTarget.id);
    mkdirSync(artifactDirectory, { recursive: true });
    runWithNode('24', [
      'node',
      'scripts/release/verify-product.mjs',
      path.join(productParent, 'renku'),
      '--mode',
      isHostReleaseTarget(releaseTarget) ? 'runtime' : 'structural',
      '--report',
      path.join(artifactDirectory, 'verification.json'),
    ]);
    runWithNode('24', [
      'node',
      'scripts/release/package-product.mjs',
      productParent,
      artifactDirectory,
    ]);
  }

  process.stdout.write(
    `Built local Studio ${tag} for ${RELEASE_TARGETS.map(({ id }) => id).join(', ')}; runtime verification ran on ${target.id}: ${paths.artifactRoot}\n`
  );
  return {
    ...paths,
    targetIds: RELEASE_TARGETS.map(({ id }) => id),
    runtimeVerifiedTargetId: target.id,
  };
}

export function assertLocalReleaseToolchain() {
  for (const command of ['fnm', 'pnpm', 'tar']) {
    requireCommand(command);
  }
  assertNodeLine('24', 24);
  return requireHostReleaseTarget();
}

function assertNodeLine(line, expectedMajor) {
  const result = runWithNode(line, ['node', '-p', 'process.versions.node'], 'pipe');
  const version = result.stdout.trim();
  if (Number.parseInt(version.split('.')[0] ?? '', 10) !== expectedMajor) {
    throw new Error(`RELEASE090 fnm ${line} resolved unsupported Node ${version}.`);
  }
}

function requirePrivateNodeRuntime(target, runtimeRoot) {
  if (!existsSync(runtimeRoot)) {
    const result = runWithNode(
      '24',
      ['node', 'scripts/release/download-node-runtime.mjs', target.id, runtimeRoot],
      'pipe'
    );
    return assertPrivateNodeRoot(result.stdout.trim().split('\n').at(-1), target);
  }
  const candidates = readdirSync(runtimeRoot, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name.startsWith(`node-v${BUNDLED_NODE_VERSION}-`)
    )
    .map((entry) => path.join(runtimeRoot, entry.name));
  if (candidates.length !== 1) {
    throw new Error(`RELEASE091 Could not reuse one private Node 24 runtime in ${runtimeRoot}.`);
  }
  return assertPrivateNodeRoot(candidates[0], target);
}

function assertPrivateNodeRoot(candidate, target) {
  const executable = targetNodeExecutable(candidate ?? '', target);
  if (!candidate || !existsSync(executable)) {
    throw new Error(
      `RELEASE091 Private Node runtime for ${target.id} is incomplete: ${candidate ?? '(missing)'}.`
    );
  }
  return candidate;
}

function runWithNode(line, args, stdio = 'inherit') {
  return runCommand('fnm', ['exec', `--using=${line}`, ...args], {
    stdio,
    env: {
      CI: 'true',
      NPM_CONFIG_PRODUCTION: 'false',
    },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const tagIndex = process.argv.indexOf('--tag');
    const tag = tagIndex >= 0 ? process.argv[tagIndex + 1] : undefined;
    if (!tag) {
      throw new Error('RELEASE092 Usage: build-local-release.mjs --tag vX.Y.Z');
    }
    buildLocalRelease(tag);
  } catch (error) {
    process.stderr.write(`[release:local-build] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
