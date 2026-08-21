#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import {
  createReadStream,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyDownloadedReleaseAssets } from './publish-github-release.mjs';

const BUCKET = 'renku-downloads';
const PUBLIC_BASE_URL = 'https://downloads.gorenku.com';
const R2_REGION = 'auto';
const R2_SERVICE = 's3';
const MULTIPART_THRESHOLD_BYTES = 64 * 1024 * 1024;
const MULTIPART_PART_SIZE_BYTES = 64 * 1024 * 1024;
const EMPTY_SHA256 = createHash('sha256').update('').digest('hex');

export function usesMultipartUpload(fileSize) {
  return fileSize >= MULTIPART_THRESHOLD_BYTES;
}

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

async function verifyExistingInfrastructure(credentials) {
  const response = await requestR2(
    {
      method: 'HEAD',
      key: '',
      headers: emptyRequestHeaders(),
    },
    credentials
  );
  if (response.statusCode !== 200) {
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

async function upload(file, key, contentType, cacheControl, options) {
  if (options.dryRun) {
    console.log(`[dry-run] ${BUCKET}/${key} <- ${file}`);
    return;
  }
  const fileSize = statSync(file).size;
  if (usesMultipartUpload(fileSize)) {
    await uploadMultipart(file, key, contentType, cacheControl, fileSize, options.credentials);
  } else {
    await uploadSingle(file, key, contentType, cacheControl, fileSize, options.credentials);
  }
  verifyPublicObject(file, key);
}

async function uploadSingle(file, key, contentType, cacheControl, fileSize, credentials) {
  await retryR2Request(`upload ${key}`, () =>
    requestR2(
      {
        method: 'PUT',
        key,
        headers: {
          ...emptyRequestHeaders('UNSIGNED-PAYLOAD'),
          'cache-control': cacheControl,
          'content-length': String(fileSize),
          'content-type': contentType,
        },
        file: { path: file, start: 0, end: fileSize },
      },
      credentials
    )
  );
}

async function uploadMultipart(file, key, contentType, cacheControl, fileSize, credentials) {
  const createResponse = await retryR2Request(`start multipart upload ${key}`, () =>
    requestR2(
      {
        method: 'POST',
        key,
        query: { uploads: '' },
        headers: {
          ...emptyRequestHeaders(),
          'cache-control': cacheControl,
          'content-length': '0',
          'content-type': contentType,
        },
      },
      credentials
    )
  );
  const uploadId = extractXmlValue(createResponse.body, 'UploadId');
  if (!uploadId) {
    throw new Error(`RELEASE044 R2 did not return a multipart upload ID for ${key}.`);
  }

  const partCount = Math.ceil(fileSize / MULTIPART_PART_SIZE_BYTES);
  console.log(`[multipart] ${BUCKET}/${key} (${partCount} parts)`);
  const completedParts = [];
  try {
    for (let partNumber = 1; partNumber <= partCount; partNumber += 1) {
      const start = (partNumber - 1) * MULTIPART_PART_SIZE_BYTES;
      const end = Math.min(start + MULTIPART_PART_SIZE_BYTES, fileSize);
      const partResponse = await retryR2Request(
        `upload ${key} part ${partNumber}/${partCount}`,
        () =>
          requestR2(
            {
              method: 'PUT',
              key,
              query: { partNumber: String(partNumber), uploadId },
              headers: {
                ...emptyRequestHeaders('UNSIGNED-PAYLOAD'),
                'content-length': String(end - start),
              },
              file: { path: file, start, end },
            },
            credentials
          )
      );
      const etag = partResponse.headers.etag;
      if (typeof etag !== 'string' || !etag) {
        throw new Error(`RELEASE044 R2 did not return an ETag for ${key} part ${partNumber}.`);
      }
      completedParts.push({ etag, partNumber });
    }

    const completeBody = Buffer.from(
      `<CompleteMultipartUpload>${completedParts
        .map(
          ({ etag, partNumber }) =>
            `<Part><PartNumber>${partNumber}</PartNumber><ETag>${xmlEscape(etag)}</ETag></Part>`
        )
        .join('')}</CompleteMultipartUpload>`
    );
    const completeResponse = await retryR2Request(`complete multipart upload ${key}`, () =>
      requestR2(
        {
          method: 'POST',
          key,
          query: { uploadId },
          headers: {
            ...emptyRequestHeaders(sha256Buffer(completeBody)),
            'content-length': String(completeBody.length),
            'content-type': 'application/xml',
          },
          body: completeBody,
        },
        credentials
      )
    );
    if (completeResponse.statusCode !== 200) {
      throw new Error(`RELEASE044 R2 could not complete multipart upload for ${key}.`);
    }
  } catch (error) {
    await abortMultipartUpload(key, uploadId, credentials);
    throw error;
  }
}

async function abortMultipartUpload(key, uploadId, credentials) {
  try {
    await requestR2(
      {
        method: 'DELETE',
        key,
        query: { uploadId },
        headers: emptyRequestHeaders(),
      },
      credentials
    );
  } catch (error) {
    console.warn(
      `[release:r2] Could not abort incomplete multipart upload for ${key}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
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
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  if (!cliOptions.dryRun && (!accountId || !accessKeyId || !secretAccessKey)) {
    throw new Error(
      'RELEASE040 CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, and CLOUDFLARE_R2_SECRET_ACCESS_KEY are required.'
    );
  }
  const { manifest, artifacts } = collectR2Artifacts(releaseRoot);
  const credentials = { accountId, accessKeyId, secretAccessKey };
  const options = { ...cliOptions, credentials };
  if (!options.dryRun) {
    await verifyExistingInfrastructure(credentials);
  }
  const reusableImmutableKeys = options.dryRun
    ? new Set()
    : findReusableImmutableKeys(artifacts);
  for (const artifact of artifacts) {
    if (reusableImmutableKeys.has(artifact.key)) {
      console.log(`[reuse] ${BUCKET}/${artifact.key}`);
    } else {
      await upload(
        artifact.file,
        artifact.key,
        artifact.contentType,
        'public, max-age=31536000, immutable',
        options
      );
    }
  }
  for (const artifact of artifacts) {
    await upload(artifact.file, artifact.channelKey, artifact.contentType, 'no-cache', options);
  }
  await upload(
    path.join(releaseRoot, 'release.json'),
    'studio/channels/beta/release.json',
    'application/json; charset=utf-8',
    'no-cache',
    options
  );
  for (const installer of manifest.installers) {
    await upload(
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

function emptyRequestHeaders(payloadHash = EMPTY_SHA256) {
  return {
    'x-amz-content-sha256': payloadHash,
  };
}

async function retryR2Request(description, operation) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        console.warn(`[release:r2] ${description} failed; retrying (${attempt}/3).`);
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  }
  throw lastError;
}

function extractXmlValue(xml, element) {
  const match = String(xml).match(new RegExp(`<${element}>([^<]+)</${element}>`));
  return match?.[1];
}

function xmlEscape(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function sha256Buffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function encodeRfc3986(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function canonicalQuery(query = {}) {
  return Object.entries(query)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${encodeRfc3986(name)}=${encodeRfc3986(value)}`)
    .join('&');
}

function canonicalObjectPath(key) {
  const encodedKey = key
    .split('/')
    .map((segment) => encodeRfc3986(segment))
    .join('/');
  return `/${BUCKET}${encodedKey ? `/${encodedKey}` : ''}`;
}

function signRequest({ method, key, query, headers, credentials, payloadHash, timestamp }) {
  const canonicalUri = canonicalObjectPath(key);
  const canonicalQueryString = canonicalQuery(query);
  const headerNames = Object.keys(headers).map((name) => name.toLowerCase()).sort();
  const canonicalHeaders = `${headerNames
    .map((name) => `${name}:${String(headers[name]).trim().replace(/\s+/g, ' ')}`)
    .join('\n')}\n`;
  const signedHeaders = headerNames.join(';');
  const dateStamp = timestamp.slice(0, 8);
  const credentialScope = `${dateStamp}/${R2_REGION}/${R2_SERVICE}/aws4_request`;
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    timestamp,
    credentialScope,
    sha256Buffer(Buffer.from(canonicalRequest)),
  ].join('\n');
  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${credentials.secretAccessKey}`, dateStamp), R2_REGION), R2_SERVICE),
    'aws4_request'
  );
  const signature = hmac(signingKey, stringToSign, 'hex');
  return `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

function hmac(key, value, encoding) {
  return createHmac('sha256', key).update(value).digest(encoding);
}

function requestR2({ method, key, query = {}, headers, body, file }, credentials) {
  const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const host = `${credentials.accountId}.r2.cloudflarestorage.com`;
  const requestHeaders = {
    host,
    ...headers,
    'x-amz-date': timestamp,
  };
  const payloadHash = requestHeaders['x-amz-content-sha256'] || 'UNSIGNED-PAYLOAD';
  requestHeaders.authorization = signRequest({
    method,
    key,
    query,
    headers: requestHeaders,
    credentials,
    payloadHash,
    timestamp,
  });
  const url = new URL(`https://${host}`);
  url.pathname = canonicalObjectPath(key);
  url.search = canonicalQuery(query);

  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method,
        headers: requestHeaders,
        timeout: 15 * 60 * 1000,
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const responseBody = Buffer.concat(chunks).toString('utf8');
          const statusCode = response.statusCode ?? 0;
          if (statusCode < 200 || statusCode >= 300) {
            reject(
              new Error(
                `RELEASE044 R2 S3 request failed (${statusCode}) for ${method} ${key}: ${responseBody.slice(0, 1000)}`
              )
            );
            return;
          }
          resolve({ body: responseBody, headers: response.headers, statusCode });
        });
      }
    );
    request.on('error', reject);
    request.on('timeout', () => request.destroy(new Error(`R2 request timed out for ${key}.`)));
    if (file) {
      createReadStream(file.path, { start: file.start, end: file.end - 1 }).pipe(request);
    } else {
      request.end(body);
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`[release:r2] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
