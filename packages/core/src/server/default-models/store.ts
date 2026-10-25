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
  const contents = await readStoredContents(storePath);
  return contents === null ? null : parseStoredDefaultModelList(contents, storePath);
}

/**
 * The source hash of the stored copy, which sync compares to skip unchanged
 * content. Sync replaces the copy whole, so it reads only the hash and never
 * requires the copy to match the current list shape.
 */
export async function readStoredDefaultModelListSha256(
  options: RenkuConfigPathOptions = {}
): Promise<string | null> {
  const contents = await readStoredContents(resolveDefaultModelListPath(options));
  if (contents === null) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(contents);
    return typeof value === 'object' && value !== null && 'sha256' in value && typeof value.sha256 === 'string' ? value.sha256 : null;
  } catch {
    return null;
  }
}

async function readStoredContents(storePath: string): Promise<string | null> {
  try {
    return await fs.readFile(storePath, 'utf8');
  } catch (error) {
    if (isMissingFile(error)) {
      return null;
    }
    throw storeError(storePath, 'read', error);
  }
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
