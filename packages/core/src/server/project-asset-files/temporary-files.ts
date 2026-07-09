import fs from 'node:fs/promises';
import path from 'node:path';
import type { ProjectRelativePath } from '../../client/index.js';
import { PROJECT_TMP_ROOT, STORYBOARDS_ROOT, kebabCasePathSegment } from '../files/asset-paths.js';
import { joinProjectRelativePath, resolveProjectRelativePath } from '../files/project-relative-paths.js';
import { requireSceneHierarchy } from './owner-lookups.js';
import { allocateProjectRelativeFilePath } from './path-allocation.js';
import { assertResolvedPathInsideProject } from './path-guards.js';
import type { ProjectTemporaryFileDestination } from './types.js';

export async function writeProjectTemporaryFile(input: {
  projectFolder: string;
  destination: ProjectTemporaryFileDestination;
  fileNameHint: string;
  contents: Uint8Array;
}): Promise<{
  projectRelativePath: ProjectRelativePath;
  absolutePath: string;
}> {
  const root = await resolveTemporaryFileRoot({
    projectFolder: input.projectFolder,
    destination: input.destination,
  });
  const fileName = kebabCasePathSegment(
    path.parse(input.fileNameHint).name,
    'temporary-file'
  );
  const extension = path.extname(input.fileNameHint) || '.bin';
  const projectRelativePath = await allocateProjectRelativeFilePath({
    projectFolder: input.projectFolder,
    parent: root,
    baseName: fileName,
    extension,
  });
  const absolutePath = resolveProjectRelativePath(
    input.projectFolder,
    projectRelativePath
  );
  assertResolvedPathInsideProject(input.projectFolder, absolutePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, input.contents);
  return { projectRelativePath, absolutePath };
}

export async function resolveTemporaryFileRoot(input: {
  session?: Parameters<typeof requireSceneHierarchy>[0];
  projectFolder: string;
  destination: ProjectTemporaryFileDestination;
}): Promise<ProjectRelativePath> {
  if (input.destination.kind === 'generation.media') {
    return joinProjectRelativePath(PROJECT_TMP_ROOT, 'media');
  }
  if (input.destination.kind === 'generation.spec') {
    return joinProjectRelativePath(PROJECT_TMP_ROOT, 'generation-specs');
  }
  if (input.destination.kind === 'generation.receipt') {
    return joinProjectRelativePath(PROJECT_TMP_ROOT, 'generation-receipts');
  }
  if (input.destination.kind === 'operation') {
    return joinProjectRelativePath(PROJECT_TMP_ROOT, 'operations');
  }
  if (input.destination.kind === 'qa') {
    return joinProjectRelativePath(PROJECT_TMP_ROOT, 'qa');
  }
  if (input.destination.kind === 'scratch') {
    return joinProjectRelativePath(PROJECT_TMP_ROOT, 'scratch');
  }
  const hierarchy = requireSceneHierarchy(input.session, input.destination.sceneId);
  return joinProjectRelativePath(
    STORYBOARDS_ROOT,
    kebabCasePathSegment(hierarchy.sequenceTitle, 'sequence'),
    kebabCasePathSegment(hierarchy.sceneTitle, 'scene'),
    'tmp'
  );
}
