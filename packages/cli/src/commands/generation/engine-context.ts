import path from 'node:path';
import {
  findProviderCredentialDescriptor,
  resolveRenkuConfigDir,
  resolveRenkuProviderCredential,
  type ProviderCredentialId,
} from '@gorenku/studio-core/server';
import {
  createFileSystemProviderMetadataCache,
  type ProviderContext,
  type ProviderExecutionContext,
} from '@gorenku/studio-engines';
import { StructuredError } from '@gorenku/studio-diagnostics';

const REQUEST_TIMEOUT_MS = 30_000;
const OPERATION_TIMEOUT_MS = 30 * 60_000;

export async function createEngineContext(input: {
  provider: string;
  homeDir?: string;
  signal: AbortSignal;
}): Promise<ProviderContext> {
  const descriptor = findProviderCredentialDescriptor(input.provider);
  if (!descriptor || input.provider === 'world-labs') {
    throw new StructuredError({
      code: 'ENGINE_PROVIDER_UNSUPPORTED',
      message: `Provider is not available through generation execute: ${input.provider}.`,
    });
  }
  const credential = await resolveRenkuProviderCredential(
    descriptor.provider as ProviderCredentialId,
    { homeDir: input.homeDir },
  );
  if (!credential) {
    throw new StructuredError({
      code: 'PROVIDER_CREDENTIALS004',
      message: `${descriptor.label} credentials are not configured.`,
      suggestion: `Configure ${descriptor.environmentVariable} in Renku Settings and try again.`,
    });
  }
  return {
    credential,
    metadataCache: createFileSystemProviderMetadataCache(
      path.join(resolveRenkuConfigDir({ homeDir: input.homeDir }), 'cache', 'provider-metadata'),
    ),
    fetch: globalThis.fetch,
    signal: input.signal,
    requestTimeoutMs: REQUEST_TIMEOUT_MS,
    operationTimeoutMs: OPERATION_TIMEOUT_MS,
  };
}

export async function createExecutionContext(input: {
  provider: string;
  homeDir?: string;
  signal: AbortSignal;
  outputDirectory: string;
}): Promise<ProviderExecutionContext> {
  return {
    ...await createEngineContext(input),
    outputDirectory: input.outputDirectory,
  };
}
