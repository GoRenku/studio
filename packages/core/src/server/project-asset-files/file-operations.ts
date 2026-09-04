import crypto from 'node:crypto';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ProjectRelativePath } from '../../client/index.js';
import type { ProjectMediaKind } from './types.js';
import { resolveProjectRelativePath } from '../files/project-relative-paths.js';
import { ProjectDataError } from '../project-data-error.js';

export async function projectPathExists(
  projectFolder: string,
  projectRelativePath: ProjectRelativePath
): Promise<boolean> {
  try {
    await fs.access(resolveProjectRelativePath(projectFolder, projectRelativePath));
    return true;
  } catch {
    return false;
  }
}

export function projectPathExistsSync(
  projectFolder: string,
  projectRelativePath: ProjectRelativePath
): boolean {
  return fsSync.existsSync(
    resolveProjectRelativePath(projectFolder, projectRelativePath)
  );
}

export async function statProjectFile(
  absolutePath: string,
  error: { code: string; message: string }
): Promise<{ size: number; isFile(): boolean }> {
  try {
    const stats = await fs.stat(absolutePath);
    if (!stats.isFile()) {
      throw new Error('not a file');
    }
    return stats;
  } catch {
    throw new ProjectDataError(error.code, error.message);
  }
}

export function statProjectFileSync(
  absolutePath: string,
  error: { code: string; message: string }
): fsSync.Stats {
  try {
    const stats = fsSync.statSync(absolutePath);
    if (!stats.isFile()) {
      throw new Error('not a file');
    }
    return stats;
  } catch {
    throw new ProjectDataError(error.code, error.message);
  }
}

export async function hashFile(absolutePath: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  const stream = fsSync.createReadStream(absolutePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}

export function hashFileSync(absolutePath: string): string {
  const hash = crypto.createHash('sha256');
  const file = fsSync.openSync(absolutePath, 'r');
  const buffer = Buffer.allocUnsafe(64 * 1024);
  try {
    let bytesRead = 0;
    do {
      bytesRead = fsSync.readSync(file, buffer, 0, buffer.length, null);
      if (bytesRead > 0) {
        hash.update(buffer.subarray(0, bytesRead));
      }
    } while (bytesRead > 0);
  } finally {
    fsSync.closeSync(file);
  }
  return hash.digest('hex');
}

export function mimeTypeForProjectPath(
  projectRelativePath: ProjectRelativePath,
  mediaKind: ProjectMediaKind
): string {
  const extension = path.extname(projectRelativePath).toLowerCase();
  if (mediaKind === 'audio') {
    if (extension === '.wav') {
      return 'audio/wav';
    }
    return 'audio/mpeg';
  }
  if (mediaKind === 'video') {
    return extension === '.mov' ? 'video/quicktime' : 'video/mp4';
  }
  if (mediaKind === 'file') {
    return 'application/octet-stream';
  }
  if (extension === '.jpg' || extension === '.jpeg') {
    return 'image/jpeg';
  }
  if (extension === '.webp') {
    return 'image/webp';
  }
  return 'image/png';
}
