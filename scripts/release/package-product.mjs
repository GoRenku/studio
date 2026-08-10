import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { requireReleaseTarget } from './release-targets.mjs';

const [productArgument, outputArgument] = process.argv.slice(2);
if (!productArgument || !outputArgument) {
  throw new Error('Usage: package-product.mjs <product-root-containing-renku> <output-directory>');
}
const productParent = path.resolve(productArgument);
const productRoot = path.join(productParent, 'renku');
if (!existsSync(path.join(productRoot, 'RELEASE.json'))) {
  throw new Error(`RELEASE010 Product tree is missing RELEASE.json: ${productRoot}`);
}
const release = JSON.parse(readFileSync(path.join(productRoot, 'RELEASE.json'), 'utf8'));
const target = requireReleaseTarget(release.target);
const outputDirectory = path.resolve(outputArgument);
mkdirSync(outputDirectory, { recursive: true });
const archiveName = target.archive === 'zip' ? 'renku.zip' : 'renku.tar.gz';
const archivePath = path.join(outputDirectory, archiveName);

if (target.archive === 'zip') {
  execFileSync('tar', ['-a', '-c', '-f', archivePath, 'renku'], {
    cwd: productParent,
    stdio: 'inherit',
  });
} else {
  execFileSync('tar', ['-czf', archivePath, 'renku'], {
    cwd: productParent,
    stdio: 'inherit',
  });
}
const hash = createHash('sha256').update(readFileSync(archivePath)).digest('hex');
writeFileSync(`${archivePath}.sha256`, `${hash}  ${archiveName}\n`);
console.log(archivePath);
