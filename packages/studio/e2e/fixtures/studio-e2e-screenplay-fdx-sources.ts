import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface StudioE2eFdxSource {
  sourceUrl: string;
  byteLength: number;
  sha256: string;
}

export const studioE2eFdxSources = {
  'big-fish.fdx': {
    sourceUrl: 'https://fountain.io/_downloads/Big-Fish.fdx',
    byteLength: 435_308,
    sha256: 'daf2e979d0e874f458ef570278b4f5750d42ee1bb18d790aaea3fec5eed5495b',
  },
  'brick-and-steel.fdx': {
    sourceUrl: 'https://fountain.io/_downloads/Brick-%26-Steel.fdx',
    byteLength: 54_504,
    sha256: 'c242f797a33ba55ad121fec758b001738f7bee46c4b170a6f5b7582d9aa8ceed',
  },
  'the-last-birthday-card.fdx': {
    sourceUrl: 'https://fountain.io/_downloads/The-Last-Birthday-Card.fdx',
    byteLength: 109_398,
    sha256: '19f11c08dd914782e591d5aadc8e6fc5bcec457ec25d58e57cfcb16f7026fed5',
  },
} as const satisfies Record<string, StudioE2eFdxSource>;

export type StudioE2eFdxFixture = keyof typeof studioE2eFdxSources;

const cacheDirectory = fileURLToPath(
  new URL('../../../../tmp/studio-e2e/screenplay-fdx/', import.meta.url)
);

export async function prepareStudioE2eScreenplayFdxSource(
  fixture: StudioE2eFdxFixture
): Promise<string> {
  const source = studioE2eFdxSources[fixture];
  const cachePath = path.join(cacheDirectory, fixture);
  await fs.mkdir(cacheDirectory, { recursive: true });

  const cachedBytes = await readCachedSource(cachePath);
  if (cachedBytes) {
    assertSourceIdentity({ fixture, source, bytes: cachedBytes, location: cachePath });
    return cachePath;
  }

  const downloadedBytes = await downloadSource({ fixture, source, cachePath });
  assertSourceIdentity({
    fixture,
    source,
    bytes: downloadedBytes,
    location: source.sourceUrl,
  });
  await writeSourceAtomically({ cachePath, bytes: downloadedBytes });
  return cachePath;
}

async function readCachedSource(cachePath: string): Promise<Buffer | undefined> {
  try {
    return await fs.readFile(cachePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

async function downloadSource(input: {
  fixture: StudioE2eFdxFixture;
  source: StudioE2eFdxSource;
  cachePath: string;
}): Promise<Buffer> {
  let response: Response;
  try {
    response = await fetch(input.source.sourceUrl);
  } catch (error) {
    throw new Error(
      `Unable to download Studio E2E FDX source ${input.fixture} from `
        + `${input.source.sourceUrl}. No valid local cache exists at `
        + `${input.cachePath}.`,
      { cause: error }
    );
  }
  if (!response.ok) {
    throw new Error(
      `Unable to download Studio E2E FDX source ${input.fixture}: `
        + `${response.status} ${response.statusText} from ${input.source.sourceUrl}.`
    );
  }
  return Buffer.from(await response.arrayBuffer());
}

function assertSourceIdentity(input: {
  fixture: StudioE2eFdxFixture;
  source: StudioE2eFdxSource;
  bytes: Buffer;
  location: string;
}): void {
  const actualSha256 = createHash('sha256').update(input.bytes).digest('hex');
  if (
    input.bytes.byteLength !== input.source.byteLength
    || actualSha256 !== input.source.sha256
  ) {
    throw new Error(
      `Studio E2E FDX source ${input.fixture} at ${input.location} does not match `
        + `the pinned source identity. Expected ${input.source.byteLength} bytes and `
        + `SHA-256 ${input.source.sha256}; received ${input.bytes.byteLength} bytes `
        + `and SHA-256 ${actualSha256}. Inspect or remove a changed cache file, or `
        + 'review the upstream source before updating the manifest.'
    );
  }
}

async function writeSourceAtomically(input: {
  cachePath: string;
  bytes: Buffer;
}): Promise<void> {
  const temporaryPath = `${input.cachePath}.${process.pid}-${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, input.bytes, { flag: 'wx' });
    await fs.rename(temporaryPath, input.cachePath);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
}
