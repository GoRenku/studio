import fs from 'node:fs/promises';
import path from 'node:path';
import { ProjectDataError } from '../../project-data-error.js';
import { hashFile } from '../../project-asset-files/file-operations.js';

export interface ScreenplaySupportingMaterialSource {
  absolutePath: string;
  filename: string;
  sha256: string;
}

export async function readScreenplaySupportingMaterialSource(
  sourcePath: string,
): Promise<ScreenplaySupportingMaterialSource> {
  const absolutePath = path.resolve(sourcePath);
  let stats;
  try {
    stats = await fs.stat(absolutePath);
  } catch {
    throw supportingMaterialInvalidSource(`Supporting material was not found or is unreadable: ${absolutePath}.`);
  }
  if (!stats.isFile()) {
    throw supportingMaterialInvalidSource(`Supporting material is not a regular file: ${absolutePath}.`);
  }

  let sha256: string;
  try {
    sha256 = await hashFile(absolutePath);
  } catch {
    throw supportingMaterialInvalidSource(`Supporting material could not be read: ${absolutePath}.`);
  }

  return {
    absolutePath,
    filename: path.basename(absolutePath),
    sha256,
  };
}

export function supportingMaterialInvalidSource(message: string): ProjectDataError {
  return new ProjectDataError(
    'SCREENPLAY_SUPPORTING_MATERIAL_INVALID_SOURCE',
    message,
    { suggestion: 'Choose a readable regular file.' },
  );
}

export function isSupportingMaterialSourceReadFailure(
  error: unknown,
  absolutePath: string,
): boolean {
  return typeof error === 'object'
    && error !== null
    && 'path' in error
    && error.path === absolutePath;
}
