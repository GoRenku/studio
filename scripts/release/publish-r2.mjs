#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyDownloadedReleaseAssets } from './publish-github-release.mjs';

const BUCKET = 'renku-downloads';
const PUBLIC_BASE_URL = 'https://downloads.gorenku.com';

export function collectR2Artifacts(releaseRoot) {
  const manifest = verifyDownloadedReleaseAssets(releaseRoot);
  const artifacts = [];
  for (const artifact of manifest.artifacts) {
    artifacts.push({
      file: path.join(releaseRoot, artifact.assetName),
      key: artifact.versionKey,
      channelKey: artifact.channelKey,
      contentType: 'application/octet-stream',
    });
    artifacts.push({
      file: path.join(releaseRoot, artifact.checksumAssetName),
      key: `${artifact.versionKey}.sha256`,
      channelKey: `${artifact.channelKey}.sha256`,
      contentType: 'text/plain; charset=utf-8',
    });
  }
  return { manifest, artifacts };
}

export function filesHaveIdenticalBytes(left, right) {
  return sha256File(left) === sha256File(right);
}

function verifyExistingInfrastructure(token, accountId) {
  const response = spawnWrangler(['r2', 'bucket', 'list'], token, accountId);
  if (!response.stdout.includes(BUCKET)) {
    throw new Error(`RELEASE042 Existing R2 bucket ${BUCKET} is not accessible.`);
  }
  const publicProbe = spawnSync(
    'curl',
    ['-fsSI', `${PUBLIC_BASE_URL}/desktop/stable/darwin/arm64/latest-mac.yml`],
    { encoding: 'utf8' }
  );
  if (publicProbe.status !== 0) {
    throw new Error(`RELEASE043 Existing public download domain is not reachable: ${PUBLIC_BASE_URL}`);
  }
}

function findReusableImmutableKeys(artifacts) {
  const reusable = new Set();
  for (const artifact of artifacts) {
    const response = spawnSync(
      'curl',
      [
        '-sS',
        '--output',
        '/dev/null',
        '--write-out',
        '%{http_code}',
        `${PUBLIC_BASE_URL}/${artifact.key}?renku-release-probe=${Date.now()}`,
      ],
      { encoding: 'utf8' }
    );
    if (response.status !== 0) {
      throw new Error(`RELEASE047 Could not check immutable object ${artifact.key}: ${response.stderr}`);
    }
    const status = response.stdout.trim();
    if (status === '404') {
      continue;
    }
    if (status !== '200') {
      throw new Error(`RELEASE048 Immutable release object returned HTTP ${status}: ${artifact.key}`);
    }
    verifyPublicObject(artifact.file, artifact.key);
    reusable.add(artifact.key);
  }
  return reusable;
}

function upload(file, key, contentType, cacheControl, options) {
  if (options.dryRun) {
    console.log(`[dry-run] ${BUCKET}/${key} <- ${file}`);
    return;
  }
  spawnWrangler(
    [
      'r2',
      'object',
      'put',
      `${BUCKET}/${key}`,
      '--file',
      file,
      '--remote',
      '--content-type',
      contentType,
      '--cache-control',
      cacheControl,
    ],
    options.token,
    options.accountId
  );
  verifyPublicObject(file, key);
}

function verifyPublicObject(localFile, key) {
  const temporary = mkdtempSync(path.join(os.tmpdir(), 'renku-r2-verify-'));
  const downloaded = path.join(temporary, 'object');
  try {
    const result = spawnSync(
      'curl',
      [
        '-fsSL',
        '--retry',
        '5',
        '--retry-delay',
        '2',
        '-H',
        'Cache-Control: no-cache',
        `${PUBLIC_BASE_URL}/${key}?renku-release=${Date.now()}`,
        '--output',
        downloaded,
      ],
      { encoding: 'utf8' }
    );
    if (result.status !== 0) {
      throw new Error(`RELEASE045 Public verification download failed for ${key}: ${result.stderr}`);
    }
    if (!filesHaveIdenticalBytes(localFile, downloaded)) {
      throw new Error(`RELEASE046 Public verification hash mismatch for ${key}.`);
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

function spawnWrangler(args, token, accountId) {
  const result = spawnSync('npx', ['--yes', 'wrangler@4.73.0', ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      CLOUDFLARE_API_TOKEN: token,
      CLOUDFLARE_ACCOUNT_ID: accountId,
    },
  });
  if (result.status !== 0) {
    throw new Error(`RELEASE044 Wrangler failed:\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

function readOptions(args) {
  const releaseIndex = args.indexOf('--release-dir');
  const releaseDir = releaseIndex >= 0 ? args[releaseIndex + 1] : undefined;
  if (!releaseDir) {
    throw new Error('Usage: publish-r2.mjs --release-dir <downloaded-github-release> [--dry-run]');
  }
  return { releaseDir, dryRun: args.includes('--dry-run') };
}

function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

async function main() {
  const cliOptions = readOptions(process.argv.slice(2));
  const releaseRoot = path.resolve(cliOptions.releaseDir);
  if (!existsSync(releaseRoot)) {
    throw new Error(`RELEASE041 GitHub Release download is missing: ${releaseRoot}`);
  }
  const token = process.env.CLOUDFLARE_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!cliOptions.dryRun && (!token || !accountId)) {
    throw new Error('RELEASE040 CLOUDFLARE_TOKEN and CLOUDFLARE_ACCOUNT_ID are required.');
  }
  const { manifest, artifacts } = collectR2Artifacts(releaseRoot);
  const options = { ...cliOptions, token, accountId };
  if (!options.dryRun) {
    verifyExistingInfrastructure(token, accountId);
  }
  const reusableImmutableKeys = options.dryRun
    ? new Set()
    : findReusableImmutableKeys(artifacts);
  for (const artifact of artifacts) {
    if (reusableImmutableKeys.has(artifact.key)) {
      console.log(`[reuse] ${BUCKET}/${artifact.key}`);
    } else {
      upload(
        artifact.file,
        artifact.key,
        artifact.contentType,
        'public, max-age=31536000, immutable',
        options
      );
    }
  }
  for (const artifact of artifacts) {
    upload(artifact.file, artifact.channelKey, artifact.contentType, 'no-cache', options);
  }
  upload(
    path.join(releaseRoot, 'release.json'),
    'studio/channels/beta/release.json',
    'application/json; charset=utf-8',
    'no-cache',
    options
  );
  for (const installer of manifest.installers) {
    upload(
      path.join(releaseRoot, installer.assetName),
      installer.key,
      installer.name.endsWith('.sh')
        ? 'text/x-shellscript; charset=utf-8'
        : 'text/plain; charset=utf-8',
      'no-store',
      options
    );
  }
  console.log(
    options.dryRun ? 'R2 publication dry run complete.' : 'R2 beta publication complete.'
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`[release:r2] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
