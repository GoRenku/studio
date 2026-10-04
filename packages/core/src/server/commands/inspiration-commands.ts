import { prepareInspirationFolderPaths, commitInspirationFolderPaths } from '../database/access/inspiration-folder-paths.js';
import { assertProjectFilePathWithoutSymlinks } from '../project-asset-files/path-guards.js';
import fs from 'node:fs/promises';
import { existsSync, renameSync, statSync } from 'node:fs';
import path from 'node:path';
import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import type {
  InspirationFolder,
  InspirationFolderDeleteReport,
  InspirationFolderMutationReport,
  InspirationFolderReorderReport,
  InspirationAnalysisValidationReport,
  InspirationAnalysisWriteReport,
  InspirationFolderReport,
  InspirationFolderResourceMutationReport,
  InspirationFolderWithResolvedPath,
  InspirationFolderResource,
  PageResponse,
  VisualLanguageProjectReport,
} from '../../client/index.js';
import {
  readProjectRecord,
  type ProjectRecord,
} from '../database/access/project.js';
import {
  listAllInspirationFolderRecords,
  insertInspirationFolderRecord,
  listInspirationFolderRecords,
  nextInspirationFolderPosition,
  requireInspirationFolderRecord,
  updateInspirationFolderPositions,

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

  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';
import { listAssetFilesInSession } from '../asset-files/projection.js';
import type {
  CreateInspirationFolderInput,
  DeleteInspirationFolderInput,
  DeleteInspirationImageInput,
  ListInspirationFoldersInput,
  ReadInspirationFolderInput,
  RenameInspirationFolderInput,
  ReorderInspirationFoldersInput,
  ReadInspirationAnalysisInput,
  ValidateInspirationAnalysisInput,
  WriteInspirationAnalysisInput,
  WriteInspirationImageInput,
} from '../project-data-service-contracts.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  allocateProjectRelativeFolderPath,
  assertProjectRelativeChildPath,

  INSPIRATION_ROOT,
  normalizeFolderFileName,
  pathExists,
} from '../visual-language-paths.js';
import {
  serializeInspirationAnalysisDocument,
  validateInspirationAnalysisDocument,
  type InspirationAnalysisSections,
} from '../visual-language-json/validator.js';
import {
  studioVisualLanguageInspirationFolderResourceKey,
  studioVisualLanguageInspirationResourceKey,
} from '../studio-coordination/resource-keys.js';
import { discardTrashObject } from '../trash/trash-lifecycle-service.js';
import { readOwnedAssetFile } from '../asset-files/projection.js';
import { importReferenceFiles } from '../reference-files/index.js';

const inspirationResourceKeys = (folderId: string): string[] => [
  studioVisualLanguageInspirationResourceKey(),
  studioVisualLanguageInspirationFolderResourceKey(folderId),
];

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
  return withVisualLanguageSession(input, ({ session }) => {
    const folder = requireInspirationFolderRecord(session, input.folderId);
    const analysis = readInspirationAnalysisRecord(session, input.folderId);
    return {
      folder: toInspirationFolder(folder),
      images: listAssetFilesInSession(session, {
        owner: { kind: 'inspirationFolder', id: folder.id },
        type: 'inspiration_image', mediaKind: 'image',
      }),
      analysis: analysis ? toInspirationAnalysis(analysis) : null,
    };
  });
}

export async function createInspirationFolder(
  input: CreateInspirationFolderInput
): Promise<InspirationFolderMutationReport> {
  return withVisualLanguageSession(input, async ({ session, projectFolder, project }) => {
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
    const folder = toInspirationFolder(record);
    return {
      valid: true,
      warnings: [],
      project: toProjectReport(project, projectFolder),
      changes: [{ type: 'inspirationFolder.created', folderId: folder.id }],
      folder,
      resourceKeys: inspirationResourceKeys(folder.id),
    };
  });
}

export async function renameInspirationFolder(
  input: RenameInspirationFolderInput
): Promise<InspirationFolderMutationReport> {
  return withVisualLanguageSession(input, async ({ session, projectFolder, project }) => {
    const folder = requireInspirationFolderRecord(session, input.folderId);
    const name = requireTrimmed(input.name, 'name');
    const currentPath = resolveProjectRelativePath(
      projectFolder,
      normalizeProjectRelativePath(folder.projectRelativePath)
    );
    if (!(await pathExists(currentPath))) {
      throw new ProjectDataError(
        'PROJECT_DATA241',
        `Inspiration folder is missing on disk: ${folder.projectRelativePath}.`,
        { issues: [createDiagnosticError('PROJECT_DATA241', 'Required Inspiration directory is missing.',
          { path: ['folderId'], context: folder.projectRelativePath })] }
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
    let moved = false;
    const now = new Date().toISOString();
    try {
      session.db.transaction((tx) => {
        const transactionSession = { ...session, db: tx };
        const currentFolder = requireInspirationFolderRecord(transactionSession, folder.id);
        if (currentFolder.projectRelativePath !== folder.projectRelativePath) {
          throw new ProjectDataError('CORE_INSPIRATION_FOLDER_RENAME_CONFLICT', 'The Inspiration folder changed during rename.');
        }
        const prepared = prepareInspirationFolderPaths(transactionSession, { folderId: folder.id,
          currentPath: folder.projectRelativePath, nextPath: nextProjectRelativePath });
        assertProjectFilePathWithoutSymlinks(projectFolder, normalizeProjectRelativePath(folder.projectRelativePath));
        assertProjectFilePathWithoutSymlinks(projectFolder, nextProjectRelativePath);
        if (!statSync(currentPath).isDirectory()) {
          throw new ProjectDataError('CORE_INSPIRATION_FOLDER_PATH_INVALID', 'The Inspiration folder path must be a directory.');
        }
        if (nextProjectRelativePath !== normalizeProjectRelativePath(folder.projectRelativePath)) {
          if (existsSync(nextPath)) {
            throw new ProjectDataError('CORE_INSPIRATION_FOLDER_RENAME_CONFLICT', 'The destination directory already exists.');
          }
          renameSync(currentPath, nextPath);
          moved = true;
        }
        commitInspirationFolderPaths(transactionSession, { folderId: folder.id, name, nextPath: nextProjectRelativePath, now, prepared });
      }, { behavior: 'immediate' });
    } catch (error) {
      if (moved) {
        try { renameSync(nextPath, currentPath); }
        catch {
          throw new ProjectDataError('CORE_INSPIRATION_FOLDER_RENAME_ROLLBACK_FAILED',
            `Folder metadata was rolled back, but the directory could not return from ${nextProjectRelativePath} to ${folder.projectRelativePath}.`,
            { issues: [createDiagnosticError('CORE_INSPIRATION_FOLDER_RENAME_ROLLBACK_FAILED', 'The directory move could not be reversed.',
              { path: ['folderId'], context: nextProjectRelativePath })],
              suggestion: `Restore the directory to ${folder.projectRelativePath} before retrying.` });
        }
      }
      if (error instanceof ProjectDataError) { throw error; }
      throw new ProjectDataError('CORE_INSPIRATION_FOLDER_RENAME_FAILED', 'Inspiration folder rename could not be committed.',
        { issues: [createDiagnosticError('CORE_INSPIRATION_FOLDER_RENAME_FAILED', 'The directory and metadata change could not be committed.',
          { path: ['folderId'], context: folder.projectRelativePath })],
          suggestion: error instanceof Error ? error.message : String(error) });
    }
    const folderResource = {
      id: folder.id,
      name,
      projectRelativePath: nextProjectRelativePath,
    };
    return {
      valid: true,
      warnings: [],
      project: toProjectReport(project, projectFolder),
      changes: [{ type: 'inspirationFolder.renamed', folderId: folder.id }],
      folder: folderResource,
      resourceKeys: inspirationResourceKeys(folder.id),
    };
  });
}

export async function reorderInspirationFolders(
  input: ReorderInspirationFoldersInput
): Promise<InspirationFolderReorderReport> {
  return withVisualLanguageSession(input, ({ session, projectFolder, project }) => {
    assertCompleteInspirationFolderReorder(session, input.folderIds);
    updateInspirationFolderPositions(session, {
      folderIds: input.folderIds,
      updatedAt: new Date().toISOString(),
    });
    const page = listInspirationFolderRecords(session, {});
    return {
      valid: true,
      warnings: [],
      project: toProjectReport(project, projectFolder),
      changes: [{ type: 'inspirationFolder.reordered' }],
      folders: { items: page.items.map(toInspirationFolder), nextCursor: page.nextCursor },
      resourceKeys: [studioVisualLanguageInspirationResourceKey()],
    };
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
): Promise<InspirationFolderDeleteReport> {
  return withVisualLanguageSession(input, ({ session, projectFolder, project }) => {
    const folder = requireInspirationFolderRecord(session, input.folderId);
    const projectRelativePath = normalizeProjectRelativePath(folder.projectRelativePath);
    assertProjectRelativeChildPath({ parent: INSPIRATION_ROOT, child: projectRelativePath });
    const report = discardTrashObject({
      session,
      project,
      projectFolder,
      itemKind: 'inspirationFolder',
      itemId: input.folderId,
      commandName: 'inspiration.folder.discard',
      changes: [{ type: 'inspirationFolder.discarded', folderId: input.folderId }],
    });
    return {
      ...report,
      folderId: input.folderId,
    };
  });
}

export async function writeInspirationImage(
  input: WriteInspirationImageInput
): Promise<InspirationFolderResourceMutationReport> {
  return withVisualLanguageSession(input, async ({ session, projectFolder, project }) => {
    const folder = requireInspirationFolderRecord(session, input.folderId);
    const fileName = normalizeFolderFileName(input.fileName);
    await fs.mkdir(path.join(projectFolder, 'tmp'), { recursive: true });
    const temporaryFolder = await fs.mkdtemp(path.join(projectFolder, 'tmp', 'inspiration-upload-'));
    const temporaryPath = path.join(temporaryFolder, fileName);
    try {
      await fs.writeFile(temporaryPath, new Uint8Array(input.contents), { flag: 'wx' });
      await importReferenceFiles({ projectName: project.projectName, homeDir: input.homeDir,
        destination: { kind: 'inspiration', folderId: folder.id },
        files: [{ sourceProjectRelativePath: path.relative(projectFolder, temporaryPath).split(path.sep).join('/') }] });
    } finally {
      await fs.rm(temporaryFolder, { recursive: true, force: true });
    }
    return {
      valid: true,
      warnings: [],
      project: toProjectReport(project, projectFolder),
      changes: [
        {
          type: 'inspirationImage.written',
          folderId: input.folderId,
          fileName,
        },
      ],
      resource: await readInspirationFolder({
        projectName: input.projectName,
        homeDir: input.homeDir,
        folderId: input.folderId,
      }),
      resourceKeys: inspirationResourceKeys(input.folderId),
    };
  });
}

export async function deleteInspirationImage(
  input: DeleteInspirationImageInput
): Promise<InspirationFolderResourceMutationReport> {
  return withVisualLanguageSession(input, async ({ session, projectFolder, project }) => {
    const folder = requireInspirationFolderRecord(session, input.folderId);
    const image = readOwnedAssetFile(session, { owner: { kind: 'inspirationFolder', id: folder.id }, assetFileId: input.assetFileId });
    if (!image || image.type !== 'inspiration_image') { throw new ProjectDataError('CORE_REFERENCE_FILE_OWNER_INVALID', 'The image must belong to this Inspiration folder.'); }
    const report = discardTrashObject({ session, project, projectFolder, itemKind: 'assetFile', itemId: image.id,
      commandName: 'inspiration.image.discard', changes: [{ type: 'inspirationImage.discarded', folderId: folder.id, assetFileId: image.id }] });
    return {
      ...report,
      resource: await readInspirationFolder({
        projectName: input.projectName,
        homeDir: input.homeDir,
        folderId: input.folderId,
      }),
      resourceKeys: inspirationResourceKeys(input.folderId),
    };
  });
}

export async function readInspirationAnalysis(
  input: ReadInspirationAnalysisInput
): Promise<InspirationFolderReport> {
  return withVisualLanguageSession(input, ({ session, projectFolder, project }) => {
    const folder = requireInspirationFolderRecord(session, input.folderId);
    const analysis = readInspirationAnalysisRecord(session, input.folderId);
    return {
      valid: true,
      warnings: [],
      project: toProjectReport(project, projectFolder),
      folder: toResolvedInspirationFolder(projectFolder, folder),
      analysis: analysis ? toInspirationAnalysis(analysis) : null,
      resourceKeys: inspirationResourceKeys(input.folderId),
    };
  });
}

export async function validateInspirationAnalysis(
  input: ValidateInspirationAnalysisInput
): Promise<InspirationAnalysisValidationReport> {
  return withVisualLanguageSession(input, async ({ session, projectFolder, project }) => {
    const folder = requireInspirationFolderRecord(session, input.folderId);
    validateInspirationAnalysisDocument({
      document: input.document,
      folderImageFiles: await readFolderImageFileNames(session, folder),
      filePath: input.filePath,
    });
    return {
      valid: true,
      warnings: [],
      project: toProjectReport(project, projectFolder),
      folder: toResolvedInspirationFolder(projectFolder, folder),
      resourceKeys: inspirationResourceKeys(input.folderId),
    };
  });
}

export async function writeInspirationAnalysis(
  input: WriteInspirationAnalysisInput
): Promise<InspirationAnalysisWriteReport> {
  return withVisualLanguageSession(input, async ({ session, projectFolder, project }) => {
    const folder = requireInspirationFolderRecord(session, input.folderId);
    const sections = serializeInspirationAnalysisDocument({
      document: input.document,
      folderImageFiles: await readFolderImageFileNames(session, folder),
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
    return {
      valid: true,
      warnings: [],
      project: toProjectReport(project, projectFolder),
      changes: [
        {
          type: 'inspirationAnalysis.upserted',
          folderId: input.folderId,
        },
      ],
      folder: toResolvedInspirationFolder(projectFolder, folder),
      analysis: toInspirationAnalysis(row),
      resourceKeys: inspirationResourceKeys(input.folderId),
    };
  });
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
      return await fn({
        ...handle,
        project: requireProjectRecord(handle.session),
      });
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

async function readFolderImageFileNames(
  session: DatabaseSession,
  folder: ReturnType<typeof requireInspirationFolderRecord>
): Promise<Set<string>> {
  return new Set(
    listAssetFilesInSession(session, { owner: { kind: 'inspirationFolder', id: folder.id },
      type: 'inspiration_image', mediaKind: 'image' }).map(
      (image) => path.posix.basename(image.projectRelativePath)
    )
  );
}

function toProjectReport(
  project: Pick<ProjectRecord, 'id' | 'projectName'>,
  projectFolder: string
): VisualLanguageProjectReport {
  return {
    id: project.id,
    projectName: project.projectName,
    projectFolder,
  };
}

function toResolvedInspirationFolder(
  projectFolder: string,
  row: Pick<
    ReturnType<typeof requireInspirationFolderRecord>,
    'id' | 'name' | 'projectRelativePath'
  >
): InspirationFolderWithResolvedPath {
  const folder = toInspirationFolder(row);
  return {
    ...folder,
    absolutePath: resolveProjectRelativePath(projectFolder, folder.projectRelativePath),
  };
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
