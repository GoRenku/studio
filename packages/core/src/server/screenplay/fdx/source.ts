import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
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
  let stats;
  try {
    stats = await fs.stat(absolutePath);
  } catch {
    throw sourceError('SCREENPLAY_FDX_SOURCE_NOT_FOUND', `FDX source was not found: ${absolutePath}.`);
  }
  if (!stats.isFile()) {
    throw sourceError('SCREENPLAY_FDX_SOURCE_NOT_FILE', `FDX source is not a regular file: ${absolutePath}.`);
  }
  if (stats.size === 0 || stats.size > MAX_FDX_SOURCE_BYTES) {
    throw sourceError(
      'SCREENPLAY_FDX_SOURCE_TOO_LARGE',
      `FDX source must contain between 1 and ${MAX_FDX_SOURCE_BYTES} bytes.`,
    );
  }

  let bytes: Buffer;
  try {
    bytes = await fs.readFile(absolutePath);
  } catch {
    throw sourceError('SCREENPLAY_FDX_SOURCE_UNREADABLE', `FDX source could not be read: ${absolutePath}.`);
  }
  if (bytes.length === 0 || bytes.length > MAX_FDX_SOURCE_BYTES) {
    throw sourceError(
      'SCREENPLAY_FDX_SOURCE_TOO_LARGE',
      `FDX source must contain between 1 and ${MAX_FDX_SOURCE_BYTES} bytes.`,
    );
  }

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
