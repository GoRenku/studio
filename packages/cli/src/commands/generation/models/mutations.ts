import fs from 'node:fs/promises';
import { importPersonalMediaModel, removePersonalMediaModel } from '@gorenku/studio-core/server';
import { StructuredError } from '@gorenku/studio-diagnostics';
import { requiredFlag } from '../../structured-command.js';
import type { GenerationCommandInput } from '../command.js';
import { createRenkuMediaEngine } from '../provider-registry.js';

export async function importGenerationModel(input: GenerationCommandInput) {
  const expectedRevision = revision(input.flags.ifRevision);
  const file = requiredFlag(typeof input.flags.file === 'string' ? input.flags.file : undefined, '--file');
  const route = await readRoute(file);
  return importPersonalMediaModel({ homeDir: input.runtime.homeDir, expectedRevision,
    route, providerIds: (input.runtime.mediaEngine ?? createRenkuMediaEngine()).providerIds });
}

export async function removeGenerationModel(input: GenerationCommandInput) {
  return removePersonalMediaModel({ homeDir: input.runtime.homeDir,
    expectedRevision: revision(input.flags.ifRevision),
    provider: requiredFlag(input.flags.provider, '--provider'),
    apiId: requiredFlag(input.flags.model, '--model') });
}

function revision(value: string | undefined): string | null {
  const text = requiredFlag(value, '--if-revision');
  return text === 'absent' ? null : text;
}

async function readRoute(file: string): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as unknown;
  } catch (error) {
    throw new StructuredError({ code: 'CLI_MEDIA_MODEL_FILE_INVALID',
      message: `Could not read media model route JSON: ${file}.`,
      suggestion: error instanceof Error ? error.message : undefined });
  }
}
