import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { constants } from 'node:fs';
import { StructuredError } from '@gorenku/studio-diagnostics';
import { resolveRenkuConfigDir, type RenkuConfigPathOptions } from '../config/index.js';
import type { MediaModelRoute, PersonalMediaModelMutation } from './contracts.js';
import { libraryError, MEDIA_MODEL_LIBRARY_MAX_BYTES, parseLibraryDocument } from './document.js';

export function libraryPath(options: RenkuConfigPathOptions): string {
  return path.join(resolveRenkuConfigDir(options), 'model-library', 'library.json');
}

export function sha256(contents: string | Buffer): string {
  return crypto.createHash('sha256').update(contents).digest('hex');
}

export async function withLibraryIo<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof StructuredError) {
      throw error;
    }
    throw libraryError('CORE_MEDIA_MODEL_LIBRARY_IO_FAILED',
      'Could not access the personal media model library.',
      error instanceof Error ? error.message : undefined);
  }
}

// Check from the configured root upward as well, so symlinked ancestors cannot
// redirect durable user content. OS-owned ancestors (for example /tmp on macOS)
// are resolved before callers choose an isolated home directory.
export async function assertSafePath(filePath: string, directory = false): Promise<void> {
  const parent = path.dirname(filePath);
  if (parent !== filePath) {
    await assertSafePath(parent, true);
  }
  try {
    const stats = await fs.lstat(filePath);
    if (stats.isSymbolicLink() || (directory ? !stats.isDirectory() : !stats.isFile())) {
      throw libraryError('CORE_MEDIA_MODEL_LIBRARY_PATH_INVALID', `Unsafe media model library path: ${filePath}.`);
    }
  } catch (error) {
    if (!hasCode(error, 'ENOENT')) {
      throw error;
    }
  }
}

export async function readLibraryFile(filePath: string): Promise<Buffer | null> {
  await assertSafePath(filePath);
  let handle;
  try {
    handle = await fs.open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if (hasCode(error, 'ENOENT')) {
      return null;
    }
    throw error;
  }
  try {
    const stats = await handle.stat();
    if (!stats.isFile() || stats.size > MEDIA_MODEL_LIBRARY_MAX_BYTES) {
      throw libraryError('CORE_MEDIA_MODEL_LIBRARY_INVALID', 'Media model document must be a regular file no larger than 1 MiB.');
    }
    const bytes = Buffer.alloc(MEDIA_MODEL_LIBRARY_MAX_BYTES + 1);
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (bytesRead === 0) {
        break;
      }
      offset += bytesRead;
    }
    if (offset > MEDIA_MODEL_LIBRARY_MAX_BYTES) {
      throw libraryError('CORE_MEDIA_MODEL_LIBRARY_INVALID', 'Media model document exceeds 1 MiB.');
    }
    return bytes.subarray(0, offset);
  } finally {
    await handle.close();
  }
}

export async function readPersonalLibrary(options: RenkuConfigPathOptions) {
  const filePath = libraryPath(options);
  const bytes = await readLibraryFile(filePath);
  return { libraryPath: filePath, revision: bytes === null ? null : sha256(bytes),
    entries: bytes === null ? [] : parseLibraryDocument(bytes.toString('utf8')).entries };
}

export async function mutatePersonalLibrary(
  input: PersonalMediaModelMutation,
  update: (entries: MediaModelRoute[]) => MediaModelRoute[]
) {
  if (input.expectedRevision !== null && !/^[a-f0-9]{64}$/.test(input.expectedRevision)) {
    throw libraryError('CORE_MEDIA_MODEL_LIBRARY_INVALID', 'Expected revision must be a SHA-256 digest or null for an absent library.');
  }
  const filePath = libraryPath(input);
  await assertSafePath(filePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  await assertSafePath(filePath);
  const lockPath = `${filePath}.lock`;
  await assertSafePath(lockPath);
  const lock = await acquireLock(lockPath);
  try {
    const current = await readPersonalLibrary(input);
    if (current.revision !== input.expectedRevision) {
      throw libraryError('CORE_MEDIA_MODEL_LIBRARY_CONFLICT', 'The personal media model library changed. Read it again before retrying.');
    }
    const contents = `${JSON.stringify({ formatVersion: 1, entries: update(current.entries) }, null, 2)}\n`;
    parseLibraryDocument(contents);
    await atomicWrite(filePath, contents);
    return { revision: sha256(contents), libraryPath: filePath };
  } finally {
    await lock.close();
    await fs.unlink(lockPath);
  }
}

async function acquireLock(lockPath: string) {
  try {
    return await fs.open(lockPath, 'wx', 0o600);
  } catch (error) {
    if (!hasCode(error, 'EEXIST')) {
      throw error;
    }
    throw libraryError('CORE_MEDIA_MODEL_LIBRARY_BUSY', 'The personal media model library has an active write lock.',
      `Retry after the writer finishes. For a stale lock, verify no writer remains before manually removing ${lockPath}.`);
  }
}

async function atomicWrite(filePath: string, contents: string): Promise<void> {
  const temporary = `${filePath}.${crypto.randomUUID()}.tmp`;
  const handle = await fs.open(temporary, 'wx', 0o600);
  try {
    try {
      await handle.writeFile(contents, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await assertSafePath(filePath);
    await fs.rename(temporary, filePath);
  } finally {
    await fs.unlink(temporary).catch((error: unknown) => {
      if (!hasCode(error, 'ENOENT')) {
        throw error;
      }
    });
  }
}

function hasCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}
