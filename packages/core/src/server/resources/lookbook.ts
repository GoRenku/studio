import type {
  LookbookImage,
  LookbookListItemWithSources,
  LookbookResource,
  LookbooksResource,
  LookbookSection,
  VisualLanguageProjectReport,
} from '../../client/index.js';
import {
  readProjectRecord,
  type ProjectRecord,
} from '../database/access/project.js';
import {
  listLookbookCardImageIds,
  listLookbookRecords,
  readActiveLookbookId,
  requireLookbookRecordById,
  toLookbook,
} from '../database/access/lookbook.js';
import {
  listLookbookSourceFoldersByLookbookId,
  listLookbookSourceInspirationFolders,
} from '../database/access/lookbook-inspirations.js';
import {
  listLookbookImages,
  readLookbookImage,
} from '../database/access/lookbook-images.js';
import { listLookbookSheets } from '../database/access/lookbook-sheets.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type {
  ListLookbooksInput,
  ReadLookbookInput,
} from '../project-data-service-contracts.js';
import {
  studioVisualLanguageLookbookResourceKey,
  studioVisualLanguageLookbooksResourceKey,
} from '../studio-coordination/resource-keys.js';
import { ProjectDataError } from '../project-data-error.js';

export async function listLookbooksResource(
  input: ListLookbooksInput
): Promise<LookbooksResource> {
  return withVisualLanguageSession(input, ({ session, projectFolder, project }) => {
    const activeLookbookId = readActiveLookbookId(session);
    const cardImageIds = listLookbookCardImageIds(session);
    const rows = listLookbookRecords(session);
    const sourceFoldersByLookbookId = listLookbookSourceFoldersByLookbookId(
      session,
      {
        projectFolder,
        lookbookIds: rows.map((row) => row.id),
      }
    );
    const lookbooks: LookbookListItemWithSources[] = rows.map((row) => ({
      lookbook: toLookbook(row),
      cardImage: readCardImage(session, cardImageIds.get(row.id), row.id),
      isActive: activeLookbookId === row.id,
      sourceInspirationFolders: sourceFoldersByLookbookId.get(row.id) ?? [],
    }));
    return {
      valid: true,
      warnings: [],
      project: toProjectReport(project, projectFolder),
      activeLookbookId,
      lookbooks,
      resourceKeys: [studioVisualLanguageLookbooksResourceKey()],
    };
  });
}

export async function readLookbookResource(
  input: ReadLookbookInput
): Promise<LookbookResource> {
  return withVisualLanguageSession(input, ({ session, projectFolder, project }) => {
    const row = requireLookbookRecordById(session, input.lookbookId);
    const images = listLookbookImages(session, row.id);
    const sheets = listLookbookSheets(session, row.id);
    const cardImageIds = listLookbookCardImageIds(session);
    return {
      valid: true,
      warnings: [],
      project: toProjectReport(project, projectFolder),
      lookbook: toLookbook(row),
      sourceInspirationFolders: listLookbookSourceInspirationFolders(session, {
        projectFolder,
        lookbookId: row.id,
      }),
      cardImage: readCardImage(session, cardImageIds.get(row.id), row.id),
      isActive: readActiveLookbookId(session) === row.id,
      images,
      sheets,
      imagesBySection: buildImagesBySection(images),
      resourceKeys: [
        studioVisualLanguageLookbooksResourceKey(),
        studioVisualLanguageLookbookResourceKey(row.id),
      ],
    };
  });
}

export function buildImagesBySection(
  images: LookbookImage[]
): Record<LookbookSection, LookbookImage[]> {
  const grouped: Record<LookbookSection, LookbookImage[]> = {
    thesis: [],
    palette: [],
    tone_mood: [],
    composition: [],
    lighting: [],
    texture: [],
    camera: [],
  };
  for (const image of images) {
    for (const section of image.sections) {
      grouped[section].push(image);
    }
  }
  return grouped;
}

function readCardImage(
  session: DatabaseSession,
  imageId: string | undefined,
  lookbookId: string
): LookbookImage | null {
  if (imageId) {
    return readLookbookImage(session, imageId);
  }
  return listLookbookImages(session, lookbookId)[0] ?? null;
}

async function withVisualLanguageSession<T>(
  input: { projectName?: string; homeDir?: string },
  fn: (handle: {
    projectFolder: string;
    project: Pick<ProjectRecord, 'id' | 'name'>;
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
      project: { id: currentProject.projectId, name: currentProject.projectName },
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
  project: Pick<ProjectRecord, 'id' | 'name'>,
  projectFolder: string
): VisualLanguageProjectReport {
  return {
    id: project.id,
    name: project.name,
    projectFolder,
  };
}
