import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ProviderExecutionContext } from '../../src/media/contracts.js';
import { createMemoryProviderMetadataCache } from '../../src/shared/metadata-cache.js';

export async function createProviderTestContext(
  credential: string,
): Promise<{ context: ProviderExecutionContext; cleanup: () => Promise<void> }> {
  const outputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-provider-e2e-'));
  return {
    context: {
      credential,
      metadataCache: createMemoryProviderMetadataCache(),
      fetch,
      signal: new AbortController().signal,
      requestTimeoutMs: 60_000,
      operationTimeoutMs: 180_000,
      outputDirectory,
    },
    cleanup: () => fs.rm(outputDirectory, { recursive: true, force: true }),
  };
}
