import type {
  LookbookImage,
  LookbookKind,
  LookbookResource,
  LookbookSection,
  ProjectLookbooksResource,
  VisualLanguageProjectReport,
} from '../../client/index.js';
import {
  readProjectRecord,
  type ProjectRecord,
} from '../database/access/project.js';
import {
  readLookbookRecordByKind,
  requireLookbookRecordByKind,
  toLookbook,
  type LookbookRecord,
} from '../database/access/lookbook.js';
import { listLookbookSourceInspirationFolders } from '../database/access/lookbook-inspirations.js';
import { listLookbookImages } from '../database/access/lookbook-images.js';
import { listLookbookSheets } from '../database/access/lookbook-sheets.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type {
  ReadProjectLookbooksInput,
  ReadLookbookByKindInput,
} from '../project-data-service-contracts.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  studioVisualLanguageLookbookResourceKey,
  studioVisualLanguageLookbooksResourceKey,
} from '../studio-coordination/resource-keys.js';
import { lookbookSectionsForType } from '../visual-language-json/validator.js';
import { readSelectedAssetRecord } from '../database/access/selected-assets.js';
import { assetSelectionTargetKey } from '../assets/selection-targets.js';

export async function readProjectLookbooksResource(
  input: ReadProjectLookbooksInput
): Promise<ProjectLookbooksResource> {
  return withVisualLanguageSession(input, ({ session, projectFolder, project }) => {
    const production = readLookbookRecordByKind(session, 'production');
    const storyboard = readLookbookRecordByKind(session, 'storyboard');
    return {
      valid: true,
      warnings: [],
      project: toProjectReport(project, projectFolder),
      production: production
        ? buildLookbookResource(session, projectFolder, project, production)
        : null,
      storyboard: storyboard
        ? buildLookbookResource(session, projectFolder, project, storyboard)
        : null,
      resourceKeys: [studioVisualLanguageLookbooksResourceKey()],
    };
  });
}

export async function readProductionLookbookResource(
  input: ReadLookbookByKindInput
): Promise<LookbookResource> {
  return readLookbookByKindResource(input, 'production');
}

export async function readStoryboardLookbookResource(
  input: ReadLookbookByKindInput
): Promise<LookbookResource> {
  return readLookbookByKindResource(input, 'storyboard');
}

async function readLookbookByKindResource(
  input: ReadLookbookByKindInput,
  kind: LookbookKind
): Promise<LookbookResource> {
  return withVisualLanguageSession(input, ({ session, projectFolder, project }) =>
    buildLookbookResource(
      session,
      projectFolder,
      project,
      requireLookbookRecordByKind(session, kind)
    )
  );
}

function buildLookbookResource(
  session: DatabaseSession,
  projectFolder: string,
  project: Pick<ProjectRecord, 'id' | 'projectName'>,
  row: LookbookRecord
): LookbookResource {
  const images = listLookbookImages(session, row.id);
  const selectedImageId = readSelectedAssetRecord(
    session,
    assetSelectionTargetKey({ kind: 'lookbook', id: row.id })
  )?.assetId ?? null;
  return {
    valid: true,
    warnings: [],
    project: toProjectReport(project, projectFolder),
    lookbook: toLookbook(row),
    sourceInspirationFolders: listLookbookSourceInspirationFolders(session, {
      projectFolder,
      lookbookId: row.id,
    }),
    selectedImageId,
    images,
    sheets: listLookbookSheets(session, row.id),
    imagesBySection: buildImagesBySection(row.kind, images),
    imagesByPoint: buildImagesByPoint(images),
    resourceKeys: [
      studioVisualLanguageLookbooksResourceKey(),
      studioVisualLanguageLookbookResourceKey(row.id),
    ],
  };
}

export function buildImagesBySection(
  kind: LookbookKind,
  images: LookbookImage[]
): Record<LookbookSection, LookbookImage[]> {
  const grouped = Object.fromEntries(
    lookbookSectionsForType(kind).map((section) => [section, []])
  ) as unknown as Record<LookbookSection, LookbookImage[]>;
  for (const image of images) {
    for (const section of image.sections) {
      grouped[section].push(image);
    }
  }
  return grouped;
}

export function buildImagesByPoint(
  images: LookbookImage[]
): Record<string, LookbookImage[]> {
  const grouped: Record<string, LookbookImage[]> = {};
  for (const image of images) {
    for (const pointId of image.points ?? []) {
      (grouped[pointId] ??= []).push(image);
    }
  }
  return grouped;
}

async function withVisualLanguageSession<T>(
  input: { projectName?: string; homeDir?: string },
  fn: (handle: {
    projectFolder: string;
    project: Pick<ProjectRecord, 'id' | 'projectName'>;
    session: DatabaseSession;
  }) => T | Promise<T>
): Promise<T> {
  if (input.projectName) {
    const handle = await openProjectSession({
      projectName: input.projectName,
      homeDir: input.homeDir,
    });
    try {
      return await fn({ ...handle, project: requireProjectRecord(handle.session) });
    } finally {
      handle.session.close();
    }
  }
  return withCurrentProjectSession(input, ({ currentProject, session }) =>
    fn({
      projectFolder: currentProject.projectFolder,
      project: { id: currentProject.projectId, projectName: currentProject.projectName },
      session,
    })
  );
}

function requireProjectRecord(session: DatabaseSession): ProjectRecord {
  const project = readProjectRecord(session);
  if (!project) {
    throw new ProjectDataError(
      'PROJECT_DATA021',
      `Project database has no project row: ${session.databasePath}.`
    );
  }
  return project;
}

function toProjectReport(
  project: Pick<ProjectRecord, 'id' | 'projectName'>,
  projectFolder: string
): VisualLanguageProjectReport {
  return { id: project.id, projectName: project.projectName, projectFolder };
}
