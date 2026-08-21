import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  STUDIO_VERSION_MANIFESTS,
  assertReleaseDispatch,
  assertReleaseTagAtHead,
  bumpSemver,
  parseReleaseTag,
  parseSemver,
  readStudioVersion,
  repositoryRoot,
  writeStudioVersion,
} from './release-contract.mjs';
import { requirePrivateNodeRuntime } from './build-local-release.mjs';
import {
  publishDraftReleaseAssets,
  stageGitHubReleaseAssets,
  verifyDownloadedReleaseAssets,
} from './publish-github-release.mjs';
import { filesHaveIdenticalBytes, usesMultipartUpload } from './publish-r2.mjs';
import { assertAboutOutput, assertStudioOnlyProduct } from './verify-product.mjs';
import {
  BUNDLED_NODE_VERSION,
  RELEASE_TARGETS,
  targetNodeExecutable,
} from './release-targets.mjs';

test('strict SemVer and tag contracts reject ambiguous release identities', () => {
  assert.deepEqual(parseSemver('1.2.3'), { major: 1, minor: 2, patch: 3 });
  assert.equal(bumpSemver('1.2.3', 'patch'), '1.2.4');
  assert.equal(bumpSemver('1.2.3', 'minor'), '1.3.0');
  assert.equal(bumpSemver('1.2.3', 'major'), '2.0.0');
  assert.equal(parseReleaseTag('v1.2.3'), '1.2.3');
  assert.throws(() => parseSemver('1.2'), /RELEASE050/);
  assert.throws(() => parseReleaseTag('release-1.2.3'), /RELEASE052/);
});

test('Studio runtime manifests share one checked-in version', () => {
  const root = createVersionFixture('0.1.0');
  assert.equal(readStudioVersion(root), '0.1.0');
  writeStudioVersion('0.2.0', root);
  assert.equal(readStudioVersion(root), '0.2.0');
  const mismatched = path.join(root, STUDIO_VERSION_MANIFESTS.at(-1));
  const manifest = JSON.parse(readFileSync(mismatched, 'utf8'));
  manifest.version = '0.2.1';
  writeFileSync(mismatched, `${JSON.stringify(manifest, null, 2)}\n`);
  assert.throws(() => readStudioVersion(root), /RELEASE054/);
});

test('release validation requires an annotated tag at the versioned HEAD', () => {
  const root = createVersionFixture('1.0.0');
  runGit(root, ['init', '-b', 'main']);
  runGit(root, ['config', 'user.email', 'release-test@gorenku.com']);
  runGit(root, ['config', 'user.name', 'Renku Release Test']);
  runGit(root, ['add', '.']);
  runGit(root, ['commit', '-m', 'release fixture']);
  runGit(root, ['tag', '-a', 'v1.0.0', '-m', 'release: v1.0.0']);
  assert.equal(assertReleaseTagAtHead('v1.0.0', root).version, '1.0.0');
  assert.equal(
    assertReleaseDispatch(
      'v1.0.0',
      { refType: 'tag', refName: 'v1.0.0' },
      root
    ).version,
    '1.0.0'
  );
  assert.throws(
    () =>
      assertReleaseDispatch(
        'v1.0.0',
        { refType: 'branch', refName: 'main' },
        root
      ),
    /RELEASE086/
  );
  assert.throws(
    () =>
      assertReleaseDispatch(
        'v1.0.0',
        { refType: 'tag', refName: 'v1.0.1' },
        root
      ),
    /RELEASE086/
  );
  runGit(root, ['tag', 'v1.0.1']);
  writeStudioVersion('1.0.1', root);
  runGit(root, ['add', '.']);
  runGit(root, ['commit', '-m', 'release: v1.0.1']);
  runGit(root, ['tag', '-f', 'v1.0.1']);
  assert.throws(() => assertReleaseTagAtHead('v1.0.1', root), /RELEASE064/);
});

test('GitHub Release staging verifies the complete native matrix and exact bytes', () => {
  const releaseRoot = mkdtempSync(path.join(os.tmpdir(), 'renku-release-matrix-'));
  const stagingRoot = mkdtempSync(path.join(os.tmpdir(), 'renku-release-assets-'));
  const version = readStudioVersion();
  for (const target of RELEASE_TARGETS) {
    writeTargetArtifact(releaseRoot, target, version, 'runtime');
  }
  const emptyStagingRoot = path.join(stagingRoot, 'assets');
  const manifest = stageGitHubReleaseAssets({
    tag: `v${version}`,
    releaseRoot,
    stagingRoot: emptyStagingRoot,
  });
  assert.equal(manifest.artifacts.length, 3);
  assert.equal(verifyDownloadedReleaseAssets(emptyStagingRoot).version, version);
  writeFileSync(path.join(emptyStagingRoot, manifest.artifacts[0].assetName), 'tampered');
  assert.throws(() => verifyDownloadedReleaseAssets(emptyStagingRoot), /RELEASE080/);
});

test('local GitHub Release staging records runtime and structural verification', () => {
  const releaseRoot = mkdtempSync(path.join(os.tmpdir(), 'renku-local-release-'));
  const stagingRoot = mkdtempSync(path.join(os.tmpdir(), 'renku-local-assets-'));
  const version = readStudioVersion();
  for (const target of RELEASE_TARGETS) {
    writeTargetArtifact(
      releaseRoot,
      target,
      version,
      target.id === 'darwin-arm64' ? 'runtime' : 'structural'
    );
  }
  const manifest = stageGitHubReleaseAssets({
    tag: `v${version}`,
    releaseRoot,
    stagingRoot: path.join(stagingRoot, 'assets'),
  });
  assert.deepEqual(manifest.targets, RELEASE_TARGETS.map(({ id }) => id));
  assert.equal(manifest.artifacts.length, 3);
  assert.deepEqual(
    manifest.artifacts.map(({ verification }) => verification.level),
    ['runtime', 'structural', 'structural']
  );
  assert.deepEqual(
    manifest.installers.map(({ name }) => name),
    ['install.sh', 'install.ps1']
  );
  assert.equal(verifyDownloadedReleaseAssets(path.join(stagingRoot, 'assets')).targets.length, 3);
});

test('R2 resume comparison accepts only identical bytes', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'renku-r2-bytes-'));
  const left = path.join(root, 'left');
  const same = path.join(root, 'same');
  const different = path.join(root, 'different');
  writeFileSync(left, 'released bytes');
  writeFileSync(same, 'released bytes');
  writeFileSync(different, 'different bytes');
  assert.equal(filesHaveIdenticalBytes(left, same), true);
  assert.equal(filesHaveIdenticalBytes(left, different), false);
});

test('R2 publication uses multipart uploads for large release archives', () => {
  assert.equal(usesMultipartUpload(64 * 1024 * 1024 - 1), false);
  assert.equal(usesMultipartUpload(64 * 1024 * 1024), true);
});

test('GitHub publication reuses a complete verified draft instead of rebuilt bytes', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'renku-github-resume-'));
  const publishedReleaseRoot = path.join(root, 'published-release');
  const publishedAssetsRoot = path.join(root, 'published-assets');
  const rebuiltReleaseRoot = path.join(root, 'rebuilt-release');
  const rebuiltAssetsRoot = path.join(root, 'rebuilt-assets');
  const downloadedAssetsRoot = path.join(root, 'downloaded-assets');
  const version = readStudioVersion();
  for (const target of RELEASE_TARGETS) {
    writeTargetArtifact(
      publishedReleaseRoot,
      target,
      version,
      'runtime',
      `published-${target.id}`
    );
    writeTargetArtifact(
      rebuiltReleaseRoot,
      target,
      version,
      'runtime',
      `rebuilt-${target.id}`
    );
  }
  const publishedManifest = stageGitHubReleaseAssets({
    tag: `v${version}`,
    releaseRoot: publishedReleaseRoot,
    stagingRoot: publishedAssetsRoot,
  });
  stageGitHubReleaseAssets({
    tag: `v${version}`,
    releaseRoot: rebuiltReleaseRoot,
    stagingRoot: rebuiltAssetsRoot,
  });

  const release = {
    tagName: `v${version}`,
    isDraft: true,
    isPrerelease: true,
    url: 'https://example.invalid/release',
    assets: readdirSync(publishedAssetsRoot).map((name) => ({ name })),
  };
  let uploadCount = 0;
  publishDraftReleaseAssets({
    tag: `v${version}`,
    stagingRoot: rebuiltAssetsRoot,
    downloadRoot: downloadedAssetsRoot,
    currentRelease: release,
    uploadDraftAssets: () => {
      uploadCount += 1;
    },
    downloadDraftAssets: (_tag, destination) => {
      mkdirSync(destination, { recursive: true });
      for (const name of readdirSync(publishedAssetsRoot)) {
        copyFileSync(
          path.join(publishedAssetsRoot, name),
          path.join(destination, name)
        );
      }
    },
  });
  assert.equal(uploadCount, 0);
  assert.deepEqual(verifyDownloadedReleaseAssets(downloadedAssetsRoot), publishedManifest);
  assert.notEqual(
    readFileSync(path.join(downloadedAssetsRoot, 'release.json'), 'utf8'),
    readFileSync(path.join(rebuiltAssetsRoot, 'release.json'), 'utf8')
  );
});

test('official Node acquisition rejects an occupied destination without deleting it', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'renku-node-destination-'));
  const output = path.join(root, 'occupied');
  mkdirSync(output);
  const sentinel = path.join(output, 'keep-me');
  writeFileSync(sentinel, 'safe');
  const result = spawnSync(
    process.execPath,
    [path.join(repositoryRoot, 'scripts/release/download-node-runtime.mjs'), 'darwin-arm64', output],
    { encoding: 'utf8' }
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /RELEASE034/);
  assert.equal(readFileSync(sentinel, 'utf8'), 'safe');
});

test('local runtime acquisition removes only its failed temporary download', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'renku-node-retry-'));
  const runtimeRoot = path.join(root, 'runtime', RELEASE_TARGETS[0].id);
  const target = RELEASE_TARGETS[0];
  let attempt = 0;
  const downloadRuntime = (_target, output) => {
    attempt += 1;
    const candidate = path.join(
      output,
      `node-v${BUNDLED_NODE_VERSION}-darwin-${target.arch}`
    );
    mkdirSync(candidate, { recursive: true });
    if (attempt === 1) {
      writeFileSync(path.join(candidate, 'partial-download'), 'incomplete');
      throw new Error('transient download failure');
    }
    const executable = targetNodeExecutable(candidate, target);
    mkdirSync(path.dirname(executable), { recursive: true });
    writeFileSync(executable, 'node');
    return candidate;
  };

  assert.throws(
    () => requirePrivateNodeRuntime(target, runtimeRoot, downloadRuntime),
    /transient download failure/
  );
  assert.equal(existsSync(runtimeRoot), false);
  const candidate = requirePrivateNodeRuntime(target, runtimeRoot, downloadRuntime);
  assert.equal(candidate.startsWith(runtimeRoot), true);
  assert.equal(existsSync(targetNodeExecutable(candidate, target)), true);
  assert.equal(attempt, 2);
});

test('installers smoke the extracted CLI before activating a version', () => {
  const shellInstaller = readFileSync(path.join(repositoryRoot, 'distribution/install.sh'), 'utf8');
  const windowsInstaller = readFileSync(path.join(repositoryRoot, 'distribution/install.ps1'), 'utf8');
  assert.ok(shellInstaller.indexOf('Renku CLI smoke validation failed') < shellInstaller.indexOf('destination="$INSTALL_ROOT/versions/$version"'));
  assert.ok(windowsInstaller.indexOf('Renku CLI smoke validation failed') < windowsInstaller.indexOf('$Destination = Join-Path $VersionsRoot'));
  for (const installer of [shellInstaller, windowsInstaller]) {
    assert.doesNotMatch(installer, /Bundled plugin|Claude Code|IDE extension/);
    assert.match(installer, /GoRenku\/studio-skills --ref beta/);
  }
});

test('product verification rejects a no-op CLI smoke response', () => {
  assert.doesNotThrow(() =>
    assertAboutOutput(JSON.stringify({ binary: 'renku', version: '0.1.0' }), '0.1.0')
  );
  assert.throws(() => assertAboutOutput('', '0.1.0'), /RELEASE020/);
  assert.throws(
    () => assertAboutOutput(JSON.stringify({ binary: 'renku', version: '0.2.0' }), '0.1.0'),
    /RELEASE020/
  );
});

test('Studio release machinery does not depend on the separate skills repository', () => {
  const releaseFiles = [
    ...readdirReleaseScripts(),
    path.join(repositoryRoot, '.github/workflows/release.yml'),
  ];
  for (const filePath of releaseFiles) {
    const contents = readFileSync(filePath, 'utf8');
    assert.doesNotMatch(contents, /studio-skills/);
  }
});

test('local publication and workflow dispatch remain separate public commands', () => {
  const rootManifest = JSON.parse(
    readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8')
  );
  assert.equal(
    rootManifest.scripts['release:publish'],
    'node --env-file-if-exists=.env scripts/release/publish.mjs'
  );
  assert.equal(
    rootManifest.scripts['release:dispatch'],
    'node --env-file-if-exists=.env scripts/release/dispatch-release-workflow.mjs'
  );
});

test('product assembly deploys into staging without legacy workspace purging', () => {
  const assembly = readFileSync(
    path.join(repositoryRoot, 'scripts/release/assemble-product.mjs'),
    'utf8'
  );
  assert.match(assembly, /--config\.inject-workspace-packages=true/);
  assert.doesNotMatch(assembly, /--legacy/);
  assert.match(assembly, /node_modules', '\.pnpm', 'lock\.yaml/);
  assert.match(assembly, /path\.join\(appRoot, 'pnpm-lock\.yaml'\)/);
});

test('release dependency policy is strict and installers do not resolve dependencies', () => {
  const workspace = readFileSync(path.join(repositoryRoot, 'pnpm-workspace.yaml'), 'utf8');
  assert.match(workspace, /minimumReleaseAge:\s*10080/);
  assert.match(workspace, /minimumReleaseAgeStrict:\s*true/);
  assert.match(workspace, /minimumReleaseAgeIgnoreMissingTime:\s*false/);
  assert.match(workspace, /trustLockfile:\s*false/);
  const installers = [
    readFileSync(path.join(repositoryRoot, 'distribution/install.sh'), 'utf8'),
    readFileSync(path.join(repositoryRoot, 'distribution/install.ps1'), 'utf8'),
  ];
  for (const installer of installers) {
    assert.doesNotMatch(installer, /\b(?:pnpm|npm|yarn)\s+(?:install|i)\b/);
  }
});

test('Studio-only product verification rejects plugin-owned roots', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'renku-product-boundary-'));
  assert.doesNotThrow(() => assertStudioOnlyProduct(root));
  mkdirSync(path.join(root, 'plugin'));
  assert.throws(() => assertStudioOnlyProduct(root), /RELEASE024/);
});

function createVersionFixture(version) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'renku-version-contract-'));
  for (const relativePath of STUDIO_VERSION_MANIFESTS) {
    const destination = path.join(root, relativePath);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, `${JSON.stringify({ name: relativePath, version }, null, 2)}\n`);
  }
  return root;
}

function runGit(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
}

function readdirReleaseScripts() {
  const releaseRoot = path.join(repositoryRoot, 'scripts/release');
  return readdirSync(releaseRoot)
    .filter((name) => name.endsWith('.mjs') && !name.endsWith('.test.mjs'))
    .map((name) => path.join(releaseRoot, name));
}

function writeTargetArtifact(releaseRoot, target, version, level, contents = target.id) {
  const directory = path.join(releaseRoot, target.id);
  mkdirSync(directory, { recursive: true });
  const archiveName = target.archive === 'zip' ? 'renku.zip' : 'renku.tar.gz';
  const archive = path.join(directory, archiveName);
  writeFileSync(archive, contents);
  const hash = createHash('sha256').update(readFileSync(archive)).digest('hex');
  writeFileSync(`${archive}.sha256`, `${hash}  ${archiveName}\n`);
  writeFileSync(
    path.join(directory, 'verification.json'),
    `${JSON.stringify(
      {
        product: 'renku',
        version,
        target: target.id,
        level,
        verifier: 'darwin-arm64',
        verifiedAt: '2026-08-11T00:00:00.000Z',
      },
      null,
      2
    )}\n`
  );
}
