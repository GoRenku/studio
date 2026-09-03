import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { StructuredError } from '@gorenku/studio-diagnostics';
import { createRenkuMediaEngine } from './provider-registry.js';
import { createEngineContext } from './engine-context.js';
import { throwEngineError } from './engine-errors.js';
import type { GenerationCommandInput } from './command.js';
import { requiredFlag } from '../structured-command.js';

export async function showGenerationSchema(input: GenerationCommandInput) {
  const provider = requiredFlag(input.flags.provider, '--provider');
  const model = requiredFlag(input.flags.model, '--model');
  const controller = new AbortController();
  try {
    const schema = await (input.runtime.mediaEngine ?? createRenkuMediaEngine()).readInputSchema(
      provider,
      model,
      await (input.runtime.createProviderContext ?? createEngineContext)({
        provider,
        homeDir: input.runtime.homeDir,
        signal: controller.signal,
      }),
    );
    if (!input.flags.output) {
      return schema;
    }
    const outputPath = await writeSchemaOutput(input.flags.output, schema);
    return { schema, outputPath };
  } catch (error) {
    if (error instanceof StructuredError) {
      throw error;
    }
    throwEngineError(error);
  }
}

async function writeSchemaOutput(output: string, schema: unknown): Promise<string> {
  const outputPath = path.resolve(output);
  const directory = path.dirname(outputPath);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(outputPath)}.${process.pid}.${crypto.randomUUID()}.tmp`
  );
  let temporaryCreated = false;
  try {
    await fs.mkdir(directory, { recursive: true });
    try {
      const stats = await fs.lstat(outputPath);
      if (!stats.isFile() || stats.isSymbolicLink()) {
        throw new Error('The output path is not a regular file.');
      }
    } catch (error) {
      if (!isNodeError(error) || error.code !== 'ENOENT') {
        throw error;
      }
    }
    const handle = await fs.open(temporaryPath, 'wx', 0o600);
    temporaryCreated = true;
    try {
      await handle.writeFile(`${JSON.stringify(schema, null, 2)}\n`, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(temporaryPath, outputPath);
    temporaryCreated = false;
    return outputPath;
  } catch (error) {
    throw new StructuredError({
      code: 'CLI166',
      message: `Could not write generation schema output: ${output}.`,
      suggestion: error instanceof Error ? error.message : undefined,
    });
  } finally {
    if (temporaryCreated) {
      await fs.unlink(temporaryPath).catch(() => undefined);
    }
  }
}

interface NodeError extends Error {
  code?: string;
}

function isNodeError(error: unknown): error is NodeError {
  return error instanceof Error && 'code' in error;
}
