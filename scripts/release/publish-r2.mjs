import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NODE_FLAVORS, RELEASE_TARGETS } from './release-targets.mjs';

const BUCKET = 'renku-downloads';
const PUBLIC_BASE_URL = 'https://downloads.gorenku.com';
const options = readOptions(process.argv.slice(2));
const releaseRoot = path.resolve(options.releaseDir);
const token = process.env.CLOUDFLARE_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!options.dryRun && (!token || !accountId)) {
  throw new Error('RELEASE040 CLOUDFLARE_TOKEN and CLOUDFLARE_ACCOUNT_ID are required.');
}

const artifacts = collectArtifacts(releaseRoot, options.version);
const releaseManifestPath = path.join(releaseRoot, 'release.json');
writeFileSync(
  releaseManifestPath,
  `${JSON.stringify(
    {
      channel: 'beta',
      version: options.version,
      artifacts: artifacts.map(({ file: _file, contentType: _contentType, ...artifact }) => artifact),
    },
    null,
    2
  )}\n`
);

if (!options.dryRun) {
  verifyExistingInfrastructure();
}
const reusableImmutableKeys = options.dryRun
  ? new Set()
  : findReusableImmutableKeys();
for (const artifact of artifacts) {
  if (reusableImmutableKeys.has(artifact.versionKey)) {
    console.log(`[reuse] ${BUCKET}/${artifact.versionKey}`);
    continue;
  }
  upload(artifact.file, artifact.versionKey, artifact.contentType, 'public, max-age=31536000, immutable');
}
for (const artifact of artifacts) {
  upload(artifact.file, artifact.channelKey, artifact.contentType, 'no-cache');
}
upload(releaseManifestPath, 'studio/channels/beta/release.json', 'application/json; charset=utf-8', 'no-cache');
upload(path.resolve('distribution/install.sh'), 'install.sh', 'text/x-shellscript; charset=utf-8', 'no-store');
upload(path.resolve('distribution/install.ps1'), 'install.ps1', 'text/plain; charset=utf-8', 'no-store');
console.log(options.dryRun ? 'R2 publication dry run complete.' : 'R2 beta publication complete.');

function collectArtifacts(root, version) {
  const result = [];
  for (const target of RELEASE_TARGETS) {
    for (const flavor of NODE_FLAVORS) {
      const archiveName = target.archive === 'zip' ? 'renku.zip' : 'renku.tar.gz';
      for (const name of [archiveName, `${archiveName}.sha256`]) {
        const file = path.join(root, target.id, flavor, name);
        if (!existsSync(file)) {
          throw new Error(`RELEASE041 Missing matrix artifact: ${file}`);
        }
        result.push({
          target: target.id,
          flavor,
          name,
          file,
          bytes: statSync(file).size,
          sha256: createHash('sha256').update(readFileSync(file)).digest('hex'),
          contentType: name.endsWith('.sha256') ? 'text/plain; charset=utf-8' : 'application/octet-stream',
          versionKey: `studio/releases/${version}/${target.id}/${flavor}/${name}`,
          channelKey: `studio/channels/beta/${target.id}/${flavor}/${name}`,
        });
      }
    }
  }
  return result;
}

function verifyExistingInfrastructure() {
  const response = spawnWrangler(['r2', 'bucket', 'list']);
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

function findReusableImmutableKeys() {
  const reusable = new Set();
  for (const artifact of artifacts) {
    const response = spawnSync(
      'curl',
      [
        '-sS',
        '--output', '/dev/null',
        '--write-out', '%{http_code}',
        `${PUBLIC_BASE_URL}/${artifact.versionKey}?renku-release-probe=${Date.now()}`,
      ],
      { encoding: 'utf8' }
    );
    if (response.status !== 0) {
      throw new Error(`RELEASE047 Could not check immutable object ${artifact.versionKey}: ${response.stderr}`);
    }
    const status = response.stdout.trim();
    if (status === '404') {
      continue;
    }
    if (status !== '200') {
      throw new Error(`RELEASE048 Immutable release object returned HTTP ${status}: ${artifact.versionKey}`);
    }
    try {
      verifyPublicObject(artifact.file, artifact.versionKey);
    } catch (error) {
      throw new Error(
        `RELEASE048 Immutable release object contains different bytes: ${artifact.versionKey}\n${error instanceof Error ? error.message : String(error)}`
      );
    }
    reusable.add(artifact.versionKey);
  }
  return reusable;
}

function upload(file, key, contentType, cacheControl) {
  if (options.dryRun) {
    console.log(`[dry-run] ${BUCKET}/${key} <- ${file}`);
    return;
  }
  spawnWrangler([
    'r2', 'object', 'put', `${BUCKET}/${key}`,
    '--file', file,
    '--remote',
    '--content-type', contentType,
    '--cache-control', cacheControl,
  ]);
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
        '--retry', '5',
        '--retry-delay', '2',
        '-H', 'Cache-Control: no-cache',
        `${PUBLIC_BASE_URL}/${key}?renku-release=${Date.now()}`,
        '--output', downloaded,
      ],
      { encoding: 'utf8' }
    );
    if (result.status !== 0) {
      throw new Error(`RELEASE045 Public verification download failed for ${key}: ${result.stderr}`);
    }
    const localHash = createHash('sha256').update(readFileSync(localFile)).digest('hex');
    const remoteHash = createHash('sha256').update(readFileSync(downloaded)).digest('hex');
    if (localHash !== remoteHash) {
      throw new Error(`RELEASE046 Public verification hash mismatch for ${key}.`);
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

function spawnWrangler(args) {
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
  const versionIndex = args.indexOf('--version');
  const releaseIndex = args.indexOf('--release-dir');
  const version = versionIndex >= 0 ? args[versionIndex + 1] : undefined;
  const releaseDir = releaseIndex >= 0 ? args[releaseIndex + 1] : undefined;
  if (!version || !releaseDir) {
    throw new Error('Usage: publish-r2.mjs --version <version> --release-dir <directory> [--dry-run]');
  }
  return { version, releaseDir, dryRun: args.includes('--dry-run') };
}
