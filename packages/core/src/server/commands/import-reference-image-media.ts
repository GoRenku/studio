import path from 'node:path';
import type {
  AssetTarget,
  ReferenceImageMediaImportReport,
} from '../../client/index.js';
import { REFERENCE_IMAGE_MEDIA_PURPOSE } from '../../client/index.js';
import type { ProjectRelativePath } from '../../client/project.js';
import { readProjectRecord } from '../database/access/project.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { openCurrentProjectHandle } from '../database/lifecycle/current-project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';
import { studioResourceKeysForAssetTarget } from '../studio-coordination/resource-keys.js';
import { registerAsset } from './register-asset.js';

export interface ImportReferenceImageMediaInput extends RenkuConfigPathOptions {
  projectName?: string;
  target: AssetTarget;
  sourceProjectRelativePath: string;
  title?: string;
  oneLineSummary?: string;
  referenceName?: string;
  referencePurpose?: string;
}

export async function importReferenceImageMedia(
  input: ImportReferenceImageMediaInput
): Promise<ReferenceImageMediaImportReport> {
  const projectContext = await readReferenceImageImportProjectContext(input);
  const imported = await registerAsset({
    projectName: projectContext.projectName,
    homeDir: input.homeDir,
    target: input.target,
    type: 'reference_image',
    mediaKind: 'image',
    title: referenceImageTitle(input),
    oneLineSummary: input.oneLineSummary,
    projectRelativePath: input.sourceProjectRelativePath as ProjectRelativePath,
    fileRole: 'primary',
    role: 'reference',
    referenceName: input.referenceName,
    purpose: input.referencePurpose,
  });
  return {
    valid: true,
    warnings: [],
    project: {
      id: projectContext.projectId,
      name: projectContext.projectName,
      projectFolder: projectContext.projectFolder,
    },
    changes: [{ type: 'reference.imageImported' }],
    purpose: REFERENCE_IMAGE_MEDIA_PURPOSE,
    target: input.target,
    imported,
    resourceKeys: studioResourceKeysForAssetTarget(input.target),
  };
}

async function readReferenceImageImportProjectContext(
  input: Pick<ImportReferenceImageMediaInput, 'projectName' | 'homeDir'>
): Promise<{ projectId: string; projectName: string; projectFolder: string }> {
  if (input.projectName) {
    const { projectFolder, session } = await openProjectSession({
      projectName: input.projectName,
      homeDir: input.homeDir,
    });
    try {
      return readReferenceImageProjectContextFromSession(session, projectFolder);
    } finally {
      session.close();
    }
  }
  const { currentProject, session } = await openCurrentProjectHandle({
    homeDir: input.homeDir,
  });
  try {
    return readReferenceImageProjectContextFromSession(
      session,
      currentProject.projectFolder
    );
  } finally {
    session.close();
  }
}

function readReferenceImageProjectContextFromSession(
  session: DatabaseSession,
  projectFolder: string
): { projectId: string; projectName: string; projectFolder: string } {
  const project = readProjectRecord(session);
  if (!project) {
    throw new ProjectDataError(
      'PROJECT_DATA021',
      `Project database has no project row: ${session.databasePath}.`
    );
  }
  return {
    projectId: project.id,
    projectName: project.name,
    projectFolder,
  };
}

function referenceImageTitle(input: ImportReferenceImageMediaInput): string {
  const title = input.title?.trim();
  if (title) {
    return title;
  }
  return path.parse(input.sourceProjectRelativePath).name || 'Reference image';
}
