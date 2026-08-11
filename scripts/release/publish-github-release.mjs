#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  parseReleaseTag,
  readStudioVersion,
  repositoryRoot,
  runCommand,
} from './release-contract.mjs';
import {
  RELEASE_TARGETS,
  requireReleaseTarget,
} from './release-targets.mjs';

export function stageGitHubReleaseAssets({
  tag,
  releaseRoot,
  stagingRoot,
  targetIds = RELEASE_TARGETS.map(({ id }) => id),
}) {
  const version = parseReleaseTag(tag);
  const targets = requireReleaseTargets(targetIds);
  if (readStudioVersion() !== version) {
    throw new Error(`RELEASE069 Tag ${tag} does not match the checked-in Studio version.`);
  }
  if (existsSync(stagingRoot) && readdirSync(stagingRoot).length > 0) {
    throw new Error(`RELEASE070 GitHub asset staging directory must be empty: ${stagingRoot}`);
  }
  mkdirSync(stagingRoot, { recursive: true });

  const artifacts = [];
  for (const target of targets) {
    const archiveName = target.archive === 'zip' ? 'renku.zip' : 'renku.tar.gz';
    const targetRoot = path.join(releaseRoot, target.id);
    const archivePath = path.join(targetRoot, archiveName);
    const checksumPath = `${archivePath}.sha256`;
    const verificationPath = path.join(targetRoot, 'verification.json');
    if (
      !existsSync(archivePath) ||
      !existsSync(checksumPath) ||
      !existsSync(verificationPath)
    ) {
      throw new Error(`RELEASE071 Missing native artifact evidence: ${targetRoot}`);
    }
    const sha256 = sha256File(archivePath);
    const recordedChecksum = readFileSync(checksumPath, 'utf8').trim().split(/\s+/)[0];
    if (recordedChecksum !== sha256) {
      throw new Error(`RELEASE072 Native checksum mismatch: ${archivePath}`);
    }
    const verification = readVerificationReport(verificationPath, {
      target: target.id,
      version,
    });
    const archiveSuffix = target.archive === 'zip' ? 'zip' : 'tar.gz';
    const assetName = `renku-${version}-${target.id}.${archiveSuffix}`;
    const checksumAssetName = `${assetName}.sha256`;
    copyFileSync(archivePath, path.join(stagingRoot, assetName));
    writeFileSync(
      path.join(stagingRoot, checksumAssetName),
      `${sha256}  ${assetName}\n`
    );
    artifacts.push({
      target: target.id,
      name: archiveName,
      assetName,
      checksumAssetName,
      bytes: statSync(archivePath).size,
      sha256,
      verification,
      versionKey: `studio/releases/${version}/${target.id}/${archiveName}`,
      channelKey: `studio/channels/beta/${target.id}/${archiveName}`,
    });
  }

  const installerNames = [
    ...(targets.some(({ platform }) => platform === 'darwin') ? ['install.sh'] : []),
    ...(targets.some(({ platform }) => platform === 'win32') ? ['install.ps1'] : []),
  ];
  const installers = installerNames.map((name) => {
    const source = path.join(repositoryRoot, 'distribution', name);
    const destination = path.join(stagingRoot, name);
    copyFileSync(source, destination);
    return {
      name,
      assetName: name,
      bytes: statSync(destination).size,
      sha256: sha256File(destination),
      key: name,
    };
  });

  const manifest = {
    product: 'renku',
    channel: 'beta',
    version,
    tag,
    targets: targets.map(({ id }) => id),
    artifacts,
    installers,
  };
  writeFileSync(
    path.join(stagingRoot, 'release.json'),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  verifyDownloadedReleaseAssets(stagingRoot);
  return manifest;
}

export function verifyDownloadedReleaseAssets(root) {
  const manifestPath = path.join(root, 'release.json');
  if (!existsSync(manifestPath)) {
    throw new Error(`RELEASE073 GitHub Release is missing release.json: ${root}`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  parseReleaseTag(manifest.tag);
  if (manifest.product !== 'renku' || manifest.channel !== 'beta') {
    throw new Error('RELEASE074 Invalid Renku GitHub Release manifest.');
  }
  if (manifest.version !== parseReleaseTag(manifest.tag)) {
    throw new Error('RELEASE075 GitHub Release tag and version disagree.');
  }
  const targets = requireReleaseTargets(manifest.targets);
  const expectedTargets = new Set(targets.map(({ id }) => id));
  const expectedNames = new Set(['release.json']);
  for (const artifact of manifest.artifacts ?? []) {
    const target = requireReleaseTarget(artifact.target);
    if (!expectedTargets.delete(target.id)) {
      throw new Error(`RELEASE077 Unexpected or duplicate native artifact: ${target.id}.`);
    }
    const archiveName = target.archive === 'zip' ? 'renku.zip' : 'renku.tar.gz';
    const archiveSuffix = target.archive === 'zip' ? 'zip' : 'tar.gz';
    const expectedAssetName = `renku-${manifest.version}-${target.id}.${archiveSuffix}`;
    if (
      artifact.name !== archiveName ||
      artifact.assetName !== expectedAssetName ||
      artifact.checksumAssetName !== `${expectedAssetName}.sha256` ||
      artifact.versionKey !==
        `studio/releases/${manifest.version}/${target.id}/${archiveName}` ||
      artifact.channelKey !==
        `studio/channels/beta/${target.id}/${archiveName}`
    ) {
      throw new Error(`RELEASE077 Invalid native artifact contract: ${target.id}.`);
    }
    validateVerificationReport(artifact.verification, {
      target: target.id,
      version: manifest.version,
    });
    expectedNames.add(artifact.assetName);
    expectedNames.add(artifact.checksumAssetName);
    const archive = path.join(root, artifact.assetName);
    const checksum = path.join(root, artifact.checksumAssetName);
    assertAsset(archive, artifact.bytes, artifact.sha256);
    const recordedChecksum = readFileSync(checksum, 'utf8').trim().split(/\s+/)[0];
    if (recordedChecksum !== artifact.sha256) {
      throw new Error(`RELEASE076 Downloaded checksum disagrees for ${artifact.assetName}.`);
    }
  }
  const expectedInstallerNames = new Set([
    ...(targets.some(({ platform }) => platform === 'darwin') ? ['install.sh'] : []),
    ...(targets.some(({ platform }) => platform === 'win32') ? ['install.ps1'] : []),
  ]);
  for (const installer of manifest.installers ?? []) {
    if (
      !expectedInstallerNames.delete(installer.name) ||
      installer.assetName !== installer.name ||
      installer.key !== installer.name
    ) {
      throw new Error(`RELEASE077 Invalid or duplicate installer asset: ${installer.name}.`);
    }
    expectedNames.add(installer.assetName);
    assertAsset(
      path.join(root, installer.assetName),
      installer.bytes,
      installer.sha256
    );
  }
  if (
    expectedTargets.size > 0 ||
    expectedInstallerNames.size > 0 ||
    manifest.artifacts?.length !== targets.length
  ) {
    throw new Error('RELEASE077 GitHub Release does not contain its declared native targets.');
  }
  const actualNames = readdirSync(root).sort();
  const unexpected = actualNames.filter((name) => !expectedNames.has(name));
  const missing = [...expectedNames].filter((name) => !actualNames.includes(name));
  if (unexpected.length > 0 || missing.length > 0) {
    throw new Error(
      `RELEASE078 GitHub Release asset set mismatch. Missing: ${missing.join(', ') || 'none'}; unexpected: ${unexpected.join(', ') || 'none'}.`
    );
  }
  return manifest;
}

function readVerificationReport(filePath, expected) {
  const report = JSON.parse(readFileSync(filePath, 'utf8'));
  validateVerificationReport(report, expected);
  return report;
}

function validateVerificationReport(report, expected) {
  if (
    report?.product !== 'renku' ||
    report.version !== expected.version ||
    report.target !== expected.target ||
    !['runtime', 'structural'].includes(report.level) ||
    typeof report.verifier !== 'string' ||
    typeof report.verifiedAt !== 'string'
  ) {
    throw new Error(
      `RELEASE077 Invalid verification report for ${expected.target}.`
    );
  }
}

function assertAsset(filePath, expectedBytes, expectedSha256) {
  if (!existsSync(filePath)) {
    throw new Error(`RELEASE079 Missing GitHub Release asset: ${filePath}`);
  }
  if (statSync(filePath).size !== expectedBytes || sha256File(filePath) !== expectedSha256) {
    throw new Error(`RELEASE080 GitHub Release asset bytes differ: ${filePath}`);
  }
}

function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function readOptions(args) {
  const valueAfter = (name) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const tag = valueAfter('--tag');
  if (!tag) {
    throw new Error(
      'RELEASE081 Usage: publish-github-release.mjs --tag vX.Y.Z --release-dir <dir> --staging-dir <dir> --download-dir <dir> [--dry-run | --finalize]'
    );
  }
  return {
    tag,
    releaseDir: valueAfter('--release-dir'),
    stagingDir: valueAfter('--staging-dir'),
    downloadDir: valueAfter('--download-dir'),
    targetIds: valueAfter('--targets')?.split(',').filter(Boolean),
    dryRun: args.includes('--dry-run'),
    finalize: args.includes('--finalize'),
  };
}

function viewRelease(tag) {
  const result = spawnSync(
    'gh',
    ['release', 'view', tag, '--json', 'tagName,isDraft,isPrerelease,url,assets'],
    { cwd: repositoryRoot, encoding: 'utf8' }
  );
  if (result.status !== 0) {
    return null;
  }
  return JSON.parse(result.stdout);
}

function ensureDraftRelease(tag) {
  const current = viewRelease(tag);
  if (!current) {
    runCommand('gh', [
      'release',
      'create',
      tag,
      '--verify-tag',
      '--draft',
      '--prerelease',
      '--generate-notes',
      '--title',
      `Renku ${tag}`,
    ]);
    return null;
  }
  if (current.tagName !== tag || !current.isDraft || !current.isPrerelease) {
    throw new Error(`RELEASE082 Existing GitHub Release ${tag} is not the expected draft prerelease.`);
  }
  return current;
}

function copyStagedAssets(source, destination) {
  if (existsSync(destination) && readdirSync(destination).length > 0) {
    throw new Error(`RELEASE083 Download directory must be empty: ${destination}`);
  }
  mkdirSync(destination, { recursive: true });
  for (const name of readdirSync(source)) {
    copyFileSync(path.join(source, name), path.join(destination, name));
  }
}

function assertDraftAssetSetCanResume(release, stagedNames) {
  const expectedNames = new Set(stagedNames);
  const actualNames = (release.assets ?? []).map(({ name }) => name);
  if (new Set(actualNames).size !== actualNames.length) {
    throw new Error('RELEASE094 Draft GitHub Release has duplicate asset names.');
  }
  const unexpectedNames = actualNames.filter((name) => !expectedNames.has(name));
  if (unexpectedNames.length > 0) {
    throw new Error(
      `RELEASE094 Draft GitHub Release has unexpected assets: ${unexpectedNames.join(', ')}.`
    );
  }
  return actualNames.length === expectedNames.size;
}

function downloadVerifiedReleaseAssets(tag, downloadRoot) {
  if (existsSync(downloadRoot) && readdirSync(downloadRoot).length > 0) {
    throw new Error(`RELEASE083 Download directory must be empty: ${downloadRoot}`);
  }
  mkdirSync(path.dirname(downloadRoot), { recursive: true });
  const temporaryRoot = mkdtempSync(path.join(path.dirname(downloadRoot), '.github-download-'));
  try {
    runCommand('gh', ['release', 'download', tag, '--dir', temporaryRoot]);
    verifyDownloadedReleaseAssets(temporaryRoot);
    copyStagedAssets(temporaryRoot, downloadRoot);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

export function publishDraftReleaseAssets({
  tag,
  stagingRoot,
  downloadRoot,
  currentRelease,
  uploadDraftAssets = uploadDraftReleaseAssets,
  downloadDraftAssets = downloadVerifiedReleaseAssets,
}) {
  const stagedNames = readdirSync(stagingRoot);
  const completeDraft = currentRelease
    ? assertDraftAssetSetCanResume(currentRelease, stagedNames)
    : false;
  if (!completeDraft) {
    const assets = stagedNames.map((name) => path.join(stagingRoot, name));
    uploadDraftAssets(tag, assets, { replaceExisting: Boolean(currentRelease) });
  }
  downloadDraftAssets(tag, downloadRoot);
}

function uploadDraftReleaseAssets(tag, assets, options) {
  runCommand('gh', [
    'release',
    'upload',
    tag,
    ...assets,
    ...(options.replaceExisting ? ['--clobber'] : []),
  ]);
}

async function main() {
  const options = readOptions(process.argv.slice(2));
  if (options.finalize) {
    const release = viewRelease(options.tag);
    if (!release?.isDraft) {
      throw new Error(`RELEASE084 Draft GitHub Release does not exist: ${options.tag}`);
    }
    runCommand('gh', ['release', 'edit', options.tag, '--draft=false', '--prerelease']);
    return;
  }
  if (!options.releaseDir || !options.stagingDir || !options.downloadDir) {
    throw new Error('RELEASE085 Draft publication requires release, staging, and download directories.');
  }
  const releaseRoot = path.resolve(options.releaseDir);
  const stagingRoot = path.resolve(options.stagingDir);
  const downloadRoot = path.resolve(options.downloadDir);
  stageGitHubReleaseAssets({
    tag: options.tag,
    releaseRoot,
    stagingRoot,
    targetIds: options.targetIds,
  });
  if (options.dryRun) {
    copyStagedAssets(stagingRoot, downloadRoot);
  } else {
    const currentRelease = ensureDraftRelease(options.tag);
    publishDraftReleaseAssets({
      tag: options.tag,
      stagingRoot,
      downloadRoot,
      currentRelease,
    });
  }
  verifyDownloadedReleaseAssets(downloadRoot);
  process.stdout.write(
    options.dryRun
      ? `GitHub Release dry run passed for ${options.tag}.\n`
      : `Draft GitHub Release assets verified for ${options.tag}.\n`
  );
}

function requireReleaseTargets(targetIds) {
  if (!Array.isArray(targetIds) || targetIds.length === 0) {
    throw new Error('RELEASE088 A release must declare at least one native target.');
  }
  const uniqueIds = new Set(targetIds);
  if (uniqueIds.size !== targetIds.length) {
    throw new Error('RELEASE088 Release target ids must be unique.');
  }
  return targetIds.map(requireReleaseTarget);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`[release:github] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
