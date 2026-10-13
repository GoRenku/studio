import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { StructuredError } from '@gorenku/studio-diagnostics';
import { resolveRenkuStateDir, type RenkuConfigPathOptions } from '../config/paths.js';
import {
  parseStoredDefaultModelList,
  type StoredDefaultModelList,
} from './document.js';

export const DEFAULT_MODEL_LIST_FILE_NAME = 'default-models.json' as const;

export function resolveDefaultModelListPath(options: RenkuConfigPathOptions = {}): string {
  return path.join(resolveRenkuStateDir(options), DEFAULT_MODEL_LIST_FILE_NAME);
}

export async function readStoredDefaultModelList(
  options: RenkuConfigPathOptions = {}
): Promise<StoredDefaultModelList | null> {
  const storePath = resolveDefaultModelListPath(options);
  let contents: string;
  try {
    contents = await fs.readFile(storePath, 'utf8');
  } catch (error) {
    if (isMissingFile(error)) {
      return null;
    }
    throw storeError(storePath, 'read', error);
  }
  return parseStoredDefaultModelList(contents, storePath);
}

export async function writeStoredDefaultModelList(
  list: StoredDefaultModelList,
  options: RenkuConfigPathOptions = {}
): Promise<string> {
  const storePath = resolveDefaultModelListPath(options);
  const temporaryPath = `${storePath}.${randomUUID()}.tmp`;
  try {
    await fs.mkdir(path.dirname(storePath), { recursive: true });
    await fs.writeFile(temporaryPath, `${JSON.stringify(list, null, 2)}\n`, { flag: 'wx' });
    await fs.rename(temporaryPath, storePath);
  } catch (error) {
    throw storeError(storePath, 'write', error);
  } finally {
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
  }
  return storePath;
}

function storeError(storePath: string, operation: 'read' | 'write', error: unknown): StructuredError {
  return new StructuredError({
    code: 'DEFAULT_MODELS002',
    message: `Cannot ${operation} the Default Model List at ${storePath}: ${error instanceof Error ? error.message : String(error)}`,
    suggestion: 'Check that the Renku state directory is writable, then sync the Default Model List again.',
  });
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
