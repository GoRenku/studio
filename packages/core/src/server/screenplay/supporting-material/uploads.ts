import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createDiagnosticWarning,
  isStructuredError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import { ProjectDataError } from '../../project-data-error.js';
import { importScreenplaySupportingMaterial } from './commands.js';
import { supportingMaterialInvalidSource } from './source.js';

export interface UploadScreenplaySupportingMaterialInput {
  projectName: string;
  homeDir?: string;
  fileName: string;
  contents: ArrayBuffer;
}

export async function uploadScreenplaySupportingMaterial(input: UploadScreenplaySupportingMaterialInput) {
  if (!input.fileName.trim() || ['.', '..'].includes(input.fileName) || /[/\\\0]/.test(input.fileName)) {
    throw supportingMaterialInvalidSource('Choose a file with a valid filename, without a directory path.');
  }
  let folder: string | undefined;
  try {
    folder = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-supporting-upload-'));
    const sourcePath = path.join(folder, input.fileName);
    await fs.writeFile(sourcePath, Buffer.from(input.contents));
    const report = await importScreenplaySupportingMaterial({
      projectName: input.projectName, homeDir: input.homeDir, sourcePath,
    });
    const cleanupWarning = await removeTemporaryUploadFolder(folder);
    if (cleanupWarning) {
      report.warnings.push(cleanupWarning);
    }
    return report;
  } catch (error) {
    if (folder) {
      await removeTemporaryUploadFolder(folder);
    }
    if (isStructuredError(error)) {
      throw error;
    }
    throw new ProjectDataError('SCREENPLAY_SUPPORTING_MATERIAL_UPLOAD_FAILED', 'The supporting file could not be uploaded.', {
      suggestion: 'Check the filename, available disk space, and filesystem permissions before retrying.',
    });
  }
}

async function removeTemporaryUploadFolder(folder: string): Promise<DiagnosticIssue | null> {
  try {
    await fs.rm(folder, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    return null;
  } catch {
    return createDiagnosticWarning(
      'SCREENPLAY_SUPPORTING_MATERIAL_UPLOAD_CLEANUP_FAILED',
      'The supporting material was imported, but its temporary upload files could not be removed.',
      { filePath: folder, path: ['supportingMaterial', 'upload'] },
      'Remove the temporary upload files manually if they remain after Studio exits.',
    );
  }
}
