import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ProviderExecutionContext } from '@gorenku/studio-engines';
import { createExecutionContext } from '../../src/commands/generation/engine-context.js';

export function isPaidProviderTestEnabled(
  optInEnvironmentVariable: string,
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return environment[optInEnvironmentVariable] === '1';
}

export async function createProviderTestContext(
  provider: string,
): Promise<{ context: ProviderExecutionContext; cleanup: () => Promise<void> }> {
  const outputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-provider-e2e-'));
  try {
    return {
      context: await createExecutionContext({
        provider,
        signal: new AbortController().signal,
        outputDirectory,
      }),
      cleanup: () => fs.rm(outputDirectory, { recursive: true, force: true }),
    };
  } catch (error) {
    await fs.rm(outputDirectory, { recursive: true, force: true });
    throw error;
  }
}
