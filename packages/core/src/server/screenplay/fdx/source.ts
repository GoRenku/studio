import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ProjectDataError } from '../../project-data-error.js';
import { FDX_LIMITS } from './limits.js';

export const MAX_FDX_SOURCE_BYTES = FDX_LIMITS.sourceBytes;

export interface FdxSource {
  absolutePath: string;
  filename: string;
  bytes: Buffer;
  sha256: string;
  xml: string;
}

export async function readFdxSource(sourcePath: string): Promise<FdxSource> {
  const absolutePath = path.resolve(sourcePath);
  const bytes = readFdxSourceBytes(absolutePath);
  return decodeFdxSource(absolutePath, bytes);
}

// Read at most the source limit plus one byte, including when an exporter grows
// the file after stat. Reopening on every call also observes rename-over saves.
export function readFdxSourceBytes(absolutePath: string): Buffer {
  let descriptor: number;
  try {
    descriptor = fs.openSync(absolutePath, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK);
  } catch (error) {
    const missing = (error as { code?: string }).code === 'ENOENT';
    throw sourceError(missing ? 'SCREENPLAY_FDX_SOURCE_NOT_FOUND' : 'SCREENPLAY_FDX_SOURCE_UNREADABLE',
      `FDX source could not be opened: ${absolutePath}.`);
  }
  try {
    const before = fs.fstatSync(descriptor);
    if (!before.isFile()) {
      throw sourceError('SCREENPLAY_FDX_SOURCE_NOT_FILE', 'FDX source is not a regular file.');
    }
    if (before.size > MAX_FDX_SOURCE_BYTES) {
      throw sourceError('SCREENPLAY_FDX_SOURCE_TOO_LARGE', 'FDX source exceeds the 10 MiB limit.');
    }
    const buffer = Buffer.alloc(MAX_FDX_SOURCE_BYTES + 1);
    let length = 0;
    while (length < buffer.length) {
      const count = fs.readSync(descriptor, buffer, length, buffer.length - length, null);
      if (count === 0) {
        break;
      }
      length += count;
    }
    if (length > MAX_FDX_SOURCE_BYTES) {
      throw sourceError('SCREENPLAY_FDX_SOURCE_TOO_LARGE', 'FDX source exceeds the 10 MiB limit.');
    }
    const after = fs.fstatSync(descriptor);
    const current = fs.statSync(absolutePath);
    if (length === 0 || !sameFileVersion(before, after) || !sameFileVersion(after, current)) {
      throw sourceError('SCREENPLAY_FDX_SOURCE_CHANGED', 'FDX export is still settling.');
    }
    return Buffer.from(buffer.subarray(0, length));
  } catch (error) {
    if (error instanceof ProjectDataError) {
      throw error;
    }
    throw sourceError('SCREENPLAY_FDX_SOURCE_UNREADABLE', `FDX source could not be read: ${absolutePath}.`);
  } finally {
    fs.closeSync(descriptor);
  }
}

function sameFileVersion(left: fs.Stats, right: fs.Stats): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.size === right.size
    && left.mtimeMs === right.mtimeMs && left.ctimeMs === right.ctimeMs;
}

export function decodeFdxSource(absolutePath: string, bytes: Buffer): FdxSource {
  let xml: string;
  try {
    xml = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw sourceError('SCREENPLAY_FDX_INVALID_XML', 'FDX source is not valid UTF-8 XML.');
  }

  return {
    absolutePath,
    filename: path.basename(absolutePath),
    bytes,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    xml,
  };
}

function sourceError(code: string, message: string): ProjectDataError {
  return new ProjectDataError(code, message, {
    suggestion: 'Choose a readable Final Draft XML screenplay file.',
  });
}
