import fs from 'node:fs/promises';
import type { Asset } from '../../../client/assets.js';
import type {
  ProjectSupportingFile,
  ProjectSupportingFileInformation,
  ProjectSupportingFilePage,
} from '../../../client/screenplay/supporting-files.js';
import { listAssetPageInSession, readOwnedAsset } from '../../assets/projection.js';
import { openProjectSession } from '../../database/lifecycle/active-session.js';
import { isPathInside } from '../../files/project-paths.js';
import { resolveProjectRelativePath } from '../../files/project-relative-paths.js';
import { ProjectDataError } from '../../project-data-error.js';
import { screenplaySourceDeleteBlock } from '../fdx/persistence/import-record.js';

interface SupportingFileInput {
  projectName: string;
  homeDir?: string;
}

export async function listProjectSupportingFiles(
  input: SupportingFileInput & { cursor?: string | null; limit?: number },
): Promise<ProjectSupportingFilePage> {
  const { session } = await openProjectSession(input);
  try {
    const page = listAssetPageInSession(session, {
      owner: { kind: 'project' },
      types: ['screenplay_source', 'screenplay_supporting_material'],
      cursor: input.cursor,
      limit: input.limit,
    });
    return { items: page.items.map(toSupportingFile), nextCursor: page.nextCursor };
  } finally {
    session.close();
  }
}

export async function readProjectSupportingFileInformation(
  input: SupportingFileInput & { assetId: string },
): Promise<ProjectSupportingFileInformation> {
  const { projectFolder, session } = await openProjectSession(input);
  try {
    const asset = readOwnedAsset(session, {
      owner: { kind: 'project' }, assetId: input.assetId,
    });
    if (!asset) {
      throw invalidSupportingFile();
    }
    const supportingFile = toSupportingFile(asset);
    return {
      supportingFile,
      absolutePath: resolveProjectRelativePath(projectFolder, asset.files[0]!.projectRelativePath),
    };
  } finally {
    session.close();
  }
}

export async function resolveProjectSupportingFile(
  input: SupportingFileInput & { assetId: string },
): Promise<ProjectSupportingFileInformation> {
  const information = await readProjectSupportingFileInformation(input);
  const { projectFolder, session } = await openProjectSession(input);
  session.close();
  let realPath: string;
  let realProject: string;
  try {
    [realPath, realProject] = await Promise.all([
      fs.realpath(information.absolutePath), fs.realpath(projectFolder),
    ]);
    if (!(await fs.stat(realPath)).isFile()) {
      throw invalidSupportingFile();
    }
  } catch {
    throw new ProjectDataError('CORE_PROJECT_ASSET_FILE_NOT_FOUND', 'The retained file is missing or unreadable.');
  }
  if (!isPathInside(realProject, realPath)) {
    throw new ProjectDataError('CORE_PROJECT_ASSET_FILE_PATH_INVALID', 'The retained file must be inside its Project folder.');
  }
  return { ...information, absolutePath: realPath };
}

function toSupportingFile(asset: Asset): ProjectSupportingFile {
  if (
    asset.owner.kind !== 'project'
    || !['screenplay_source', 'screenplay_supporting_material'].includes(asset.type)
    || asset.files.length !== 1
    || asset.files[0]?.role !== 'source'
  ) {
    throw invalidSupportingFile();
  }
  return {
    asset,
    sourceAssetFileId: asset.files[0].id,
    deleteBlock: screenplaySourceDeleteBlock(asset.type),
  };
}

function invalidSupportingFile(): ProjectDataError {
  return new ProjectDataError(
    'SCREENPLAY_SUPPORTING_FILE_INVALID_ASSET',
    'The supporting file must be an active Project-owned import with one retained source file.',
  );
}
