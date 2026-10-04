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

export function referenceMediaKindForProjectPath(projectRelativePath: ProjectRelativePath): ProjectMediaKind {
  const extension = path.extname(projectRelativePath).toLowerCase();
  if (['.apng', '.avif', '.gif', '.jpeg', '.jpg', '.png', '.webp'].includes(extension)) {
    return 'image';
  }
  if (['.mp4', '.mov', '.webm'].includes(extension)) {
    return 'video';
  }
  if (['.wav', '.mp3', '.ogg', '.flac', '.m4a'].includes(extension)) {
    return 'audio';
  }
  return 'file';
}

export function mimeTypeForProjectPath(
  projectRelativePath: ProjectRelativePath,
  mediaKind: ProjectMediaKind
): string {
  const extension = path.extname(projectRelativePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.apng': 'image/apng', '.avif': 'image/avif', '.gif': 'image/gif',
    '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
    '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
    '.flac': 'audio/flac', '.m4a': 'audio/mp4',
  };
  return mimeTypes[extension] ?? (mediaKind === 'file' ? 'application/octet-stream'
    : mediaKind === 'audio' ? 'audio/mpeg' : mediaKind === 'video' ? 'video/mp4' : 'image/png');
}
