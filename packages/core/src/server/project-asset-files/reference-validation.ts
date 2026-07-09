import type { MediaKind } from '../../client/index.js';
import { normalizeProjectRelativePath, resolveProjectRelativePath } from '../files/project-relative-paths.js';
import { statProjectFile } from './file-operations.js';
import { assertResolvedPathInsideProject } from './path-guards.js';
import type { ProjectReferenceFileValidation } from './types.js';

export async function validateProjectReferenceFileInput(input: {
  projectFolder: string;
  projectRelativePath: string;
  mediaKind?: MediaKind;
  role?: string;
}): Promise<ProjectReferenceFileValidation> {
  const projectRelativePath = normalizeProjectRelativePath(
    input.projectRelativePath
  );
  const absolutePath = resolveProjectRelativePath(
    input.projectFolder,
    projectRelativePath
  );
  assertResolvedPathInsideProject(input.projectFolder, absolutePath);
  const stats = await statProjectFile(absolutePath, {
    code: 'PROJECT_ASSET_FILE_SOURCE_NOT_FOUND',
    message: `Project reference file was not found: ${projectRelativePath}.`,
  });
  return {
    projectRelativePath,
    absolutePath,
    sizeBytes: stats.size,
  };
}
