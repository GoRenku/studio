import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { requireReleaseTarget } from './release-targets.mjs';

const NODE_VERSION = '24.16.0';
const [targetId, outputArgument] = process.argv.slice(2);
if (!targetId || !outputArgument) {
  throw new Error('Usage: download-node-runtime.mjs <target> <output-directory>');
}
const target = requireReleaseTarget(targetId);
const platformName = target.platform === 'win32' ? 'win' : 'darwin';
const extension = target.platform === 'win32' ? 'zip' : 'tar.gz';
const fileName = `node-v${NODE_VERSION}-${platformName}-${target.arch}.${extension}`;
const baseUrl = `https://nodejs.org/dist/v${NODE_VERSION}`;
const output = path.resolve(outputArgument);
if (existsSync(output)) {
  throw new Error(`RELEASE034 Output directory already exists: ${output}`);
}
mkdirSync(output, { recursive: true });
const archive = path.join(output, fileName);

const [checksums, archiveBytes] = await Promise.all([
  fetchBytes(`${baseUrl}/SHASUMS256.txt`),
  fetchBytes(`${baseUrl}/${fileName}`),
]);
const checksumLine = checksums.toString('utf8').split('\n').find((line) => line.endsWith(`  ${fileName}`));
if (!checksumLine) {
  throw new Error(`RELEASE030 Official Node checksum is missing for ${fileName}.`);
}
const expected = checksumLine.split(/\s+/)[0];
const actual = createHash('sha256').update(archiveBytes).digest('hex');
if (expected !== actual) {
  throw new Error(`RELEASE031 Official Node checksum mismatch for ${fileName}.`);
}
writeFileSync(archive, archiveBytes);
execFileSync('tar', ['-xf', archive, '-C', output]);
const extracted = readdirSync(output).find((name) => name.startsWith(`node-v${NODE_VERSION}-`));
if (!extracted || !existsSync(path.join(output, extracted))) {
  throw new Error('RELEASE032 Official Node archive did not contain the expected root directory.');
}
console.log(path.join(output, extracted));

async function fetchBytes(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`RELEASE033 Could not download ${url}: HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}
