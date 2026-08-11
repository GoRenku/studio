import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
);

export const STUDIO_VERSION_MANIFESTS = Object.freeze([
  'package.json',
  'packages/diagnostics/package.json',
  'packages/engines/package.json',
  'packages/core/package.json',
  'packages/studio/package.json',
  'packages/cli/package.json',
]);

export function parseSemver(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`RELEASE050 Version must be strict SemVer X.Y.Z: ${version}`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

export function bumpSemver(version, bumpType) {
  const current = parseSemver(version);
  if (bumpType === 'major') {
    return `${current.major + 1}.0.0`;
  }
  if (bumpType === 'minor') {
    return `${current.major}.${current.minor + 1}.0`;
  }
  if (bumpType === 'patch') {
    return `${current.major}.${current.minor}.${current.patch + 1}`;
  }
  throw new Error(`RELEASE051 Unsupported version bump: ${bumpType}`);
}

export function parseReleaseTag(tag) {
  const match = /^v(\d+\.\d+\.\d+)$/.exec(tag);
  if (!match) {
    throw new Error(`RELEASE052 Release tag must match vX.Y.Z: ${tag}`);
  }
  parseSemver(match[1]);
  return match[1];
}

export function readStudioVersion(root = repositoryRoot) {
  const versions = STUDIO_VERSION_MANIFESTS.map((relativePath) => {
    const manifest = readJson(path.join(root, relativePath));
    if (typeof manifest.version !== 'string') {
      throw new Error(`RELEASE053 Missing version in ${relativePath}.`);
    }
    parseSemver(manifest.version);
    return { relativePath, version: manifest.version };
  });
  const canonicalVersion = versions[0].version;
  const mismatches = versions.filter(({ version }) => version !== canonicalVersion);
  if (mismatches.length > 0) {
    throw new Error(
      `RELEASE054 Studio runtime versions are not synchronized:\n${versions
        .map(({ relativePath, version }) => `${relativePath}: ${version}`)
        .join('\n')}`
    );
  }
  return canonicalVersion;
}

export function writeStudioVersion(version, root = repositoryRoot) {
  parseSemver(version);
  for (const relativePath of STUDIO_VERSION_MANIFESTS) {
    const manifestPath = path.join(root, relativePath);
    const manifest = readJson(manifestPath);
    manifest.version = version;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

export function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repositoryRoot,
    encoding: 'utf8',
    stdio: options.stdio ?? 'inherit',
    env: { ...process.env, ...options.env },
  });
  if (!options.allowFailure && result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(
      `RELEASE055 Command failed (${command} ${args.join(' ')})${details ? `:\n${details}` : '.'}`
    );
  }
  return result;
}

export function commandOutput(command, args, options = {}) {
  return (runCommand(command, args, { ...options, stdio: 'pipe' }).stdout ?? '').trim();
}

export function requireCommand(command) {
  const probe = runCommand(command, ['--version'], {
    stdio: 'pipe',
    allowFailure: true,
  });
  if (probe.status !== 0) {
    throw new Error(`RELEASE056 Required command is unavailable: ${command}`);
  }
}

export function assertMainBranch(root = repositoryRoot) {
  const branch = commandOutput('git', ['branch', '--show-current'], { cwd: root });
  if (branch !== 'main') {
    throw new Error(`RELEASE057 Releases must run from main; current branch is ${branch || '(detached)'}.`);
  }
}

export function assertCleanTree(root = repositoryRoot) {
  const status = commandOutput('git', ['status', '--porcelain'], { cwd: root });
  if (status) {
    throw new Error('RELEASE058 The working tree must be clean before a release.');
  }
}

export function fetchOriginMain(root = repositoryRoot) {
  runCommand('git', ['fetch', '--quiet', 'origin', 'main'], { cwd: root });
}

export function assertHeadEqualsOriginMain(root = repositoryRoot) {
  const head = commandOutput('git', ['rev-parse', 'HEAD'], { cwd: root });
  const originMain = commandOutput('git', ['rev-parse', 'refs/remotes/origin/main'], { cwd: root });
  if (head !== originMain) {
    throw new Error('RELEASE059 Local main must exactly match origin/main before preparing a release.');
  }
}

export function assertOriginMainIsAncestor(root = repositoryRoot) {
  const result = runCommand(
    'git',
    ['merge-base', '--is-ancestor', 'refs/remotes/origin/main', 'HEAD'],
    { cwd: root, stdio: 'pipe', allowFailure: true }
  );
  if (result.status !== 0) {
    throw new Error('RELEASE060 Local main has diverged from origin/main.');
  }
}

export function assertTagMissing(tag, root = repositoryRoot) {
  parseReleaseTag(tag);
  const local = runCommand('git', ['rev-parse', '--verify', `refs/tags/${tag}`], {
    cwd: root,
    stdio: 'pipe',
    allowFailure: true,
  });
  if (local.status === 0) {
    throw new Error(`RELEASE061 Tag already exists locally: ${tag}`);
  }
  const remote = runCommand('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`], {
    cwd: root,
    stdio: 'pipe',
    allowFailure: true,
  });
  if (remote.status !== 0) {
    throw new Error(`RELEASE062 Could not inspect origin for tag ${tag}.`);
  }
  if ((remote.stdout ?? '').trim()) {
    throw new Error(`RELEASE061 Tag already exists on origin: ${tag}`);
  }
}

export function assertReleaseTagAtHead(tag, root = repositoryRoot) {
  const version = parseReleaseTag(tag);
  const studioVersion = readStudioVersion(root);
  if (version !== studioVersion) {
    throw new Error(
      `RELEASE063 Tag ${tag} does not match the checked-in Studio version ${studioVersion}.`
    );
  }
  const tagType = commandOutput('git', ['cat-file', '-t', `refs/tags/${tag}`], { cwd: root });
  if (tagType !== 'tag') {
    throw new Error(`RELEASE064 Studio release tags must be annotated: ${tag}`);
  }
  const tagCommit = commandOutput('git', ['rev-list', '-n', '1', tag], { cwd: root });
  const head = commandOutput('git', ['rev-parse', 'HEAD'], { cwd: root });
  if (tagCommit !== head) {
    throw new Error(`RELEASE065 Tag ${tag} does not point to HEAD.`);
  }
  return { version, commit: head };
}

export function assertReleaseDispatch(tag, workflowRef, root = repositoryRoot) {
  if (workflowRef.refType !== 'tag' || workflowRef.refName !== tag) {
    throw new Error(`RELEASE086 Dispatch release.yml from the exact tag passed as input: ${tag}.`);
  }
  return assertReleaseTagAtHead(tag, root);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}
