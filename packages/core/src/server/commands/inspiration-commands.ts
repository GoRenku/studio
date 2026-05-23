import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  InspirationAnalysis,
  InspirationFolder,
  InspirationFolderResource,
  PageResponse,
} from '../../client/index.js';
import {
  deleteInspirationFolderRecord,
  listAllInspirationFolderRecords,
  insertInspirationFolderRecord,
  listInspirationFolderRecords,
  nextInspirationFolderPosition,
  requireInspirationFolderRecord,
  updateInspirationFolderPositions,
  updateInspirationFolderRecord,
} from '../database/access/inspiration-folders.js';
import {
  readInspirationAnalysisRecord,
  toInspirationAnalysis,
  upsertInspirationAnalysisRecord,
} from '../database/access/inspiration-analysis.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
} from '../entity-ids.js';
import {
  joinProjectRelativePath,
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';
import { listInspirationImagesFromFolder } from '../files/inspiration-images.js';
import type {
  CreateInspirationFolderInput,
  DeleteInspirationFolderInput,
  DeleteInspirationImageInput,
  ListInspirationFoldersInput,
  ReadInspirationFolderInput,
  RenameInspirationFolderInput,
  ReorderInspirationFoldersInput,
  UpsertInspirationAnalysisInput,
  WriteInspirationImageInput,
} from '../project-data-service-contracts.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  allocateProjectRelativeFolderPath,
  assertProjectRelativeChildPath,
  assertResolvedPathInsideProject,
  INSPIRATION_ROOT,
  normalizeFolderFileName,
  pathExists,
} from '../visual-language-paths.js';
import {
  serializeInspirationAnalysisSections,
  type InspirationAnalysisSections,
} from '../visual-language-json/validator.js';

export async function listInspirationFolders(
  input: ListInspirationFoldersInput
): Promise<PageResponse<InspirationFolder>> {
  return withVisualLanguageSession(input, ({ session }) => {
    const page = listInspirationFolderRecords(session, input);
    return {
      items: page.items.map(toInspirationFolder),
      nextCursor: page.nextCursor,
    };
  });
}

export async function readInspirationFolder(
  input: ReadInspirationFolderInput
): Promise<InspirationFolderResource> {
  return withVisualLanguageSession(input, async ({ session, projectFolder }) => {
    const folder = requireInspirationFolderRecord(session, input.folderId);
    const analysis = readInspirationAnalysisRecord(session, input.folderId);
    return {
      folder: toInspirationFolder(folder),
      images: await listInspirationImagesFromFolder(projectFolder, folder),
      analysis: analysis ? toInspirationAnalysis(analysis) : null,
    };
  });
}

export async function createInspirationFolder(
  input: CreateInspirationFolderInput
): Promise<InspirationFolder> {
  return withVisualLanguageSession(input, async ({ session, projectFolder }) => {
    const name = requireTrimmed(input.name, 'name');
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    const projectRelativePath = await allocateProjectRelativeFolderPath({
      projectFolder,
      parent: INSPIRATION_ROOT,
      label: name,
    });
    await fs.mkdir(resolveProjectRelativePath(projectFolder, projectRelativePath), {
      recursive: true,
    });
    const now = new Date().toISOString();
    const record = {
      id: ids('inspiration_folder'),
      name,
      projectRelativePath,
      position: nextInspirationFolderPosition(session),
      createdAt: now,
      updatedAt: now,
    };
    insertInspirationFolderRecord(session, record);
    return toInspirationFolder(record);
  });
}

export async function renameInspirationFolder(
  input: RenameInspirationFolderInput
): Promise<InspirationFolder> {
  return withVisualLanguageSession(input, async ({ session, projectFolder }) => {
    const folder = requireInspirationFolderRecord(session, input.folderId);
    const name = requireTrimmed(input.name, 'name');
    const currentPath = resolveProjectRelativePath(
      projectFolder,
      normalizeProjectRelativePath(folder.projectRelativePath)
    );
    if (!(await pathExists(currentPath))) {
      throw new ProjectDataError(
        'PROJECT_DATA241',
        `Inspiration folder is missing on disk: ${folder.projectRelativePath}.`
      );
    }
    const nextProjectRelativePath = await allocateProjectRelativeFolderPath({
      projectFolder,
      parent: INSPIRATION_ROOT,
      label: name,
      currentProjectRelativePath: normalizeProjectRelativePath(
        folder.projectRelativePath
      ),
    });
    const nextPath = resolveProjectRelativePath(projectFolder, nextProjectRelativePath);
    if (nextProjectRelativePath !== normalizeProjectRelativePath(folder.projectRelativePath)) {
      await fs.mkdir(path.dirname(nextPath), { recursive: true });
      await fs.rename(currentPath, nextPath);
    }

    const now = new Date().toISOString();
    updateInspirationFolderRecord(session, {
      folderId: folder.id,
      name,
      projectRelativePath: nextProjectRelativePath,
      updatedAt: now,
    });
    return {
      id: folder.id,
      name,
      projectRelativePath: nextProjectRelativePath,
    };
  });
}

export async function reorderInspirationFolders(
  input: ReorderInspirationFoldersInput
): Promise<PageResponse<InspirationFolder>> {
  return withVisualLanguageSession(input, ({ session }) => {
    assertCompleteInspirationFolderReorder(session, input.folderIds);
    updateInspirationFolderPositions(session, {
      folderIds: input.folderIds,
      updatedAt: new Date().toISOString(),
    });
    const page = listInspirationFolderRecords(session, {});
    return { items: page.items.map(toInspirationFolder), nextCursor: page.nextCursor };
  });
}

function assertCompleteInspirationFolderReorder(
  session: DatabaseSession,
  folderIds: string[]
): void {
  const existingIds = new Set(
    listAllInspirationFolderRecords(session).map((folder) => folder.id)
  );
  const requestedIds = new Set(folderIds);
  const duplicateIds = folderIds.filter(
    (folderId, index) => folderIds.indexOf(folderId) !== index
  );
  const missingIds = [...existingIds].filter((folderId) => !requestedIds.has(folderId));
  const unknownIds = [...requestedIds].filter((folderId) => !existingIds.has(folderId));

  if (
    duplicateIds.length === 0 &&
    missingIds.length === 0 &&
    unknownIds.length === 0 &&
    requestedIds.size === existingIds.size
  ) {
    return;
  }

  throw new ProjectDataError(
    'PROJECT_DATA246',
    'Inspiration folder reorder must include every existing folder exactly once.',
    {
      suggestion:
        'Read the current Inspiration folders, then send their folder ids once in the desired order.',
    }
  );
}

export async function deleteInspirationFolder(
  input: DeleteInspirationFolderInput
): Promise<void> {
  return withVisualLanguageSession(input, async ({ session, projectFolder }) => {
    const folder = requireInspirationFolderRecord(session, input.folderId);
    const projectRelativePath = normalizeProjectRelativePath(folder.projectRelativePath);
    assertProjectRelativeChildPath({ parent: INSPIRATION_ROOT, child: projectRelativePath });
    await fs.rm(resolveProjectRelativePath(projectFolder, projectRelativePath), {
      recursive: true,
      force: true,
    });
    deleteInspirationFolderRecord(session, input.folderId);
  });
}

export async function writeInspirationImage(
  input: WriteInspirationImageInput
): Promise<InspirationFolderResource> {
  return withVisualLanguageSession(input, async ({ session, projectFolder }) => {
    const folder = requireInspirationFolderRecord(session, input.folderId);
    const fileName = normalizeFolderFileName(input.fileName);
    const folderPath = normalizeProjectRelativePath(folder.projectRelativePath);
    const imagePath = joinProjectRelativePath(folderPath, fileName);
    const absolutePath = resolveProjectRelativePath(projectFolder, imagePath);
    assertResolvedPathInsideProject(projectFolder, absolutePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    const bytes =
      input.contents instanceof Uint8Array
        ? input.contents
        : new Uint8Array(input.contents);
    await fs.writeFile(absolutePath, bytes);
    return readInspirationFolder({
      projectName: input.projectName,
      homeDir: input.homeDir,
      folderId: input.folderId,
    });
  });
}

export async function deleteInspirationImage(
  input: DeleteInspirationImageInput
): Promise<InspirationFolderResource> {
  return withVisualLanguageSession(input, async ({ session, projectFolder }) => {
    const folder = requireInspirationFolderRecord(session, input.folderId);
    const fileName = normalizeFolderFileName(input.fileName);
    const folderPath = normalizeProjectRelativePath(folder.projectRelativePath);
    const imagePath = joinProjectRelativePath(folderPath, fileName);
    assertProjectRelativeChildPath({ parent: folderPath, child: imagePath });
    await fs.rm(resolveProjectRelativePath(projectFolder, imagePath), { force: true });
    return readInspirationFolder({
      projectName: input.projectName,
      homeDir: input.homeDir,
      folderId: input.folderId,
    });
  });
}

export async function upsertInspirationAnalysis(
  input: UpsertInspirationAnalysisInput
): Promise<InspirationAnalysis> {
  return withVisualLanguageSession(input, async ({ session, projectFolder }) => {
    const folder = requireInspirationFolderRecord(session, input.folderId);
    const folderImageFiles = new Set(
      (await listInspirationImagesFromFolder(projectFolder, folder)).map(
        (image) => image.fileName
      )
    );
    const sections = serializeInspirationAnalysisSections({
      sections: input.sections,
      folderImageFiles,
      filePath: input.filePath,
    });
    upsertInspirationAnalysisRecord(session, {
      folderId: input.folderId,
      sections,
      now: new Date().toISOString(),
    });
    const row = readInspirationAnalysisRecord(session, input.folderId);
    if (!row) {
      throw new ProjectDataError(
        'PROJECT_DATA242',
        `Inspiration analysis was not written: ${input.folderId}.`
      );
    }
    return toInspirationAnalysis(row);
  });
}

async function withVisualLanguageSession<T>(
  input: { projectName?: string; homeDir?: string },
  fn: (handle: { projectFolder: string; session: DatabaseSession }) => T | Promise<T>
): Promise<T> {
  if (input.projectName) {
    const handle = await openProjectSession({
      projectName: input.projectName,
      homeDir: input.homeDir,
    });
    try {
      return await fn(handle);
    } finally {
      handle.session.close();
    }
  }
  return withCurrentProjectSession(input, ({ currentProject, session }) =>
    fn({ projectFolder: currentProject.projectFolder, session })
  );
}

function requireTrimmed(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ProjectDataError('PROJECT_DATA081', `${fieldName} cannot be empty.`);
  }
  return trimmed;
}

function toInspirationFolder(
  row: Pick<
    ReturnType<typeof requireInspirationFolderRecord>,
    'id' | 'name' | 'projectRelativePath'
  >
): InspirationFolder {
  return {
    id: row.id,
    name: row.name,
    projectRelativePath: normalizeProjectRelativePath(row.projectRelativePath),
  };
}

export type { InspirationAnalysisSections };
