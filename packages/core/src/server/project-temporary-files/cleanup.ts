import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  CleanProjectTemporaryFilesInput,
  ProjectTemporaryFilesCleanupReport,
} from '../../client/project-temporary-files.js';
import { assetFiles } from '../schema/assets.js';
import { normalizeProjectRelativePath, resolveProjectRelativePath } from '../files/project-relative-paths.js';
import { ProjectDataError } from '../project-data-error.js';
import { withProject } from '../project-operation.js';

export async function cleanProjectTemporaryFiles(
  input: CleanProjectTemporaryFilesInput
): Promise<ProjectTemporaryFilesCleanupReport> {
  return withProject(input, async ({ session, projectFolder }) => {
    const report = { removedFiles: 0, removedBytes: 0 };
    const root = path.join(await fs.realpath(projectFolder), 'tmp');
    try {
      const stat = await fs.lstat(root).catch((error: { code?: string }) => {
        if (error.code === 'ENOENT') {
          return null;
        }
        throw error;
      });
      if (!stat) {
        return report;
      }
      if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw new ProjectDataError('CORE_PROJECT_TMP_INVALID', 'Project tmp must be a directory, not a link.');
      }
      const registered = session.db.select({ path: assetFiles.projectRelativePath }).from(assetFiles).all();
      for (const file of registered) {
        const absolutePath = resolveProjectRelativePath(projectFolder, normalizeProjectRelativePath(file.path));
        const resolved = await fs.realpath(absolutePath).catch((error: { code?: string }) => {
          // Missing registered files have no bytes for cleanup to remove.
          if (error.code === 'ENOENT') {
            return null;
          }
          throw error;
        });
        const relative = resolved === null ? null : path.relative(root, resolved);
        const insideTmp = relative !== null && relative !== '..'
          && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
        if (file.path === 'tmp' || file.path.startsWith('tmp/') || insideTmp) {
          throw new ProjectDataError(
            'CORE_PROJECT_TMP_REGISTERED_ASSET',
            `Temporary files contain registered media: ${file.path}. Cleanup was not performed.`,
            { suggestion: 'Ensure this registered file is retained outside Project tmp, correcting any directory links, before retrying cleanup.' }
          );
        }
      }
      await clearDirectory(root, report);
      return report;
    } catch (error) {
      if (error instanceof ProjectDataError) {
        throw error;
      }
      throw new ProjectDataError(
        'CORE_PROJECT_TMP_CLEANUP_FAILED',
        `Cleanup stopped after removing ${report.removedFiles} files (${report.removedBytes} bytes). ${error instanceof Error ? error.message : String(error)}`,
        { suggestion: 'Check file permissions and retry cleanup. Remaining files were not removed.' }
      );
    }
  });
}

async function clearDirectory(directory: string, report: ProjectTemporaryFilesCleanupReport): Promise<void> {
  for (const name of await fs.readdir(directory)) {
    const target = path.join(directory, name);
    const stat = await fs.lstat(target);
    if (stat.isDirectory() && !stat.isSymbolicLink()) {
      await clearDirectory(target, report);
      await fs.rmdir(target);
    } else {
      await fs.unlink(target);
      report.removedFiles += 1;
      report.removedBytes += stat.size;
    }
  }
}
