import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const upgradeFixtures = JSON.parse(readFileSync(new URL('./fixtures.json', import.meta.url), 'utf8')).fixtures;
export function sha256File(file) { return createHash('sha256').update(readFileSync(file)).digest('hex'); }
export function coreRoot(product) {
  return realpathSync(path.join(product, 'app/node_modules/@gorenku/studio-core'));
}
export function releaseIdentity(product) {
  const release = JSON.parse(readFileSync(path.join(product, 'RELEASE.json'), 'utf8'));
  if (release.product !== 'renku' || !/^\d+\.\d+\.\d+$/.test(release.version)) {
    throw new Error('RELEASE077 Invalid extracted product identity.');
  }
  return release;
}
export function extractVerifiedArchive(archive, expectedSha256, destination) {
  if (!/^[a-f0-9]{64}$/.test(expectedSha256) || sha256File(archive) !== expectedSha256) {
    throw new Error(`RELEASE077 Archive checksum mismatch: ${archive}`);
  }
  if (existsSync(destination) && readdirSync(destination).length) {
    throw new Error(`RELEASE077 Extraction destination must be empty: ${destination}`);
  }
  mkdirSync(destination, { recursive: true });
  execFileSync('tar', ['-xf', path.resolve(archive), '-C', destination]);
  const product = path.join(destination, 'renku');
  releaseIdentity(product);
  writeFileSync(path.join(destination, 'archive.json'), JSON.stringify({ archive: path.resolve(archive), sha256: expectedSha256 }));
  return product;
}
function treeHashes(root) {
  const files = {};
  const visit = (folder) => {
    for (const name of readdirSync(folder).sort()) {
      const file = path.join(folder, name);
      const stats = lstatSync(file);
      if (stats.isSymbolicLink()) { files[path.relative(root, file)] = { link: readlinkSync(file) }; }
      else if (stats.isDirectory()) { visit(file); }
      else { files[path.relative(root, file)] = sha256File(file); }
    }
  };
  visit(root);
  return files;
}
export function verifyExtractedArchive(product, expectedSha256) {
  const receipt = JSON.parse(readFileSync(path.join(path.dirname(product), 'archive.json'), 'utf8'));
  if (expectedSha256 && receipt.sha256 !== expectedSha256) {
    throw new Error('RELEASE077 Extracted source archive is not in the immutable fixture inventory.');
  }
  // Compare the supplied product with a fresh extraction; a receipt alone cannot attest its bytes.
  const reference = extractVerifiedArchive(receipt.archive, receipt.sha256,
    mkdtempSync(path.join(os.tmpdir(), 'studio-upgrade-archive-reference-')));
  assert.deepEqual(treeHashes(product), treeHashes(reference), 'RELEASE077 Extracted product differs from its archive');
  return receipt.sha256;
}
export function fixtureForProduct(product) {
  const release = releaseIdentity(product);
  const fixture = upgradeFixtures.find(({ sourceVersion }) => sourceVersion === release.version);
  if (!fixture?.archives[release.target]) { throw new Error('RELEASE077 No required source fixture for this product.'); }
  const archiveSha256 = verifyExtractedArchive(product, fixture.archives[release.target].sha256);
  const journal = path.join(coreRoot(product), 'drizzle/meta/_journal.json');
  if (sha256File(journal) !== fixture.migrationJournalSha256) {
    throw new Error('RELEASE077 Shipped source migration journal differs from the immutable inventory.');
  }
  return { ...fixture, archiveSha256 };
}
export function assertImmutableMigrationHistory(sourceProduct, targetProduct) {
  const source = path.join(coreRoot(sourceProduct), 'drizzle');
  const target = path.join(coreRoot(targetProduct), 'drizzle');
  const sourceJournal = JSON.parse(readFileSync(path.join(source, 'meta/_journal.json'), 'utf8'));
  const targetJournal = JSON.parse(readFileSync(path.join(target, 'meta/_journal.json'), 'utf8'));
  assert.deepEqual(targetJournal.entries.slice(0, sourceJournal.entries.length), sourceJournal.entries,
    'RELEASE077 Shipped migration journal entries changed');
  for (const entry of sourceJournal.entries) {
    const sql = `${entry.tag}.sql`;
    assert.equal(sha256File(path.join(source, sql)), sha256File(path.join(target, sql)), `RELEASE077 Shipped migration changed: ${sql}`);
  }
  for (const name of readdirSync(path.join(source, 'meta')).filter((name) => name.endsWith('_snapshot.json'))) {
    assert.equal(sha256File(path.join(source, 'meta', name)), sha256File(path.join(target, 'meta', name)),
      `RELEASE077 Shipped snapshot changed: ${name}`);
  }
}
