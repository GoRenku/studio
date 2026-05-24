import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  LookbookImage,
  LookbookImageMutationReport,
  LookbookSourceInspirationsReport,
  LookbookValidationReport,
  LookbookWriteReport,
  VisualLanguageCommandReport,
  VisualLanguageProjectReport,
} from '../../client/index.js';
import {
  deleteAssetFileRecordsForAsset,
  insertAssetFileRecord,
} from '../database/access/asset-files.js';
import {
  deleteAssetRecord,
  insertAssetRecord,
} from '../database/access/assets.js';
import {
  clearLookbookCardImageRecord,
  deleteLookbookRecord,
  insertLookbookRecord,
  readActiveLookbookId,
  readLookbookRecordById,
  requireLookbookRecordById,
  setActiveLookbookRecord,
  setLookbookCardImageRecord,
  toLookbook,
  updateLookbookRecord,
} from '../database/access/lookbook.js';
import {
  listLookbookSourceInspirationFolders,
  replaceLookbookInspirationRecords,
} from '../database/access/lookbook-inspirations.js';
import {
  deleteLookbookImageRecord,
  insertLookbookImageRecord,
  listLookbookImages,
  nextLookbookImageSortOrder,
  readLookbookImage,
  requireLookbookImageRecord,
  setLookbookImageSectionRecords,
} from '../database/access/lookbook-images.js';
import {
  requireInspirationFolderRecord,
} from '../database/access/inspiration-folders.js';
import {
  readProjectRecord,
  type ProjectRecord,
} from '../database/access/project.js';
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
import type {
  ClearActiveLookbookInput,
  CreateLookbookInput,
  DeleteLookbookImageInput,
  DeleteLookbookInput,
  ImportLookbookImageInput,
  ListLookbookSourceInspirationsInput,
  RenameLookbookInput,
  SetActiveLookbookInput,
  SetLookbookCardImageInput,
  SetLookbookImageSectionsInput,
  SetLookbookSourceInspirationsInput,
  UpdateLookbookInput,
  ValidateLookbookInput,
} from '../project-data-service-contracts.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  assertLookbookSections,
  serializeLookbookDocument,
  validateLookbookDocument,
  validateLookbookSourceInspirationsDocument,
} from '../visual-language-json/validator.js';
import {
  allocateProjectRelativeFilePath,
  assertProjectRelativeChildPath,
  assertResolvedPathInsideProject,
  LOOKBOOK_ROOT,
} from '../visual-language-paths.js';

const lookbookIndexResourceKey = 'surface:visual-language:lookbooks';

const lookbookResourceKeys = (lookbookId: string): string[] => [
  lookbookIndexResourceKey,
  `surface:visual-language:lookbook:${lookbookId}`,
];

export async function validateLookbook(
  input: ValidateLookbookInput
): Promise<LookbookValidationReport> {
  return withVisualLanguageSession(input, ({ session, projectFolder, project }) => {
    validateLookbookDocument({ document: input.document, filePath: input.filePath });
    const sourceInspirationFolderIds =
      input.document.sourceInspirationFolderIds ?? [];
    assertExistingUniqueInspirationFolderIds(session, sourceInspirationFolderIds);
    return {
      valid: true,
      warnings: [],
      project: toProjectReport(project, projectFolder),
      sourceInspirationFolders: sourceInspirationFolderIds.map((folderId) =>
        toResolvedInspirationFolder(
          projectFolder,
          requireInspirationFolderRecord(session, folderId)
        )
      ),
      resourceKeys: [lookbookIndexResourceKey],
    };
  });
}

export async function createLookbook(
  input: CreateLookbookInput
): Promise<LookbookWriteReport> {
  return withVisualLanguageSession(input, ({ session, projectFolder, project }) => {
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    const sections = serializeLookbookDocument({
      document: input.document,
      filePath: input.filePath,
    });
    const sourceInspirationFolderIds =
      input.document.sourceInspirationFolderIds ?? [];
    assertExistingUniqueInspirationFolderIds(session, sourceInspirationFolderIds);
    const now = new Date().toISOString();
    const lookbookId = ids('lookbook');
    session.db.transaction((tx) => {
      const txSession = { ...session, db: tx };
      insertLookbookRecord(txSession, {
        id: lookbookId,
        name: normalizeLookbookName(input.name),
        sections,
        now,
      });
      replaceLookbookInspirationRecords(txSession, {
        lookbookId,
        inspirationFolderIds: sourceInspirationFolderIds,
        nextId: () => ids('lookbook_inspiration'),
        now,
      });
    });
    const row = readLookbookRecordById(session, lookbookId);
    if (!row) {
      throw new ProjectDataError('PROJECT_DATA243', 'Lookbook was not written.');
    }
    return {
      valid: true,
      warnings: [],
      project: toProjectReport(project, projectFolder),
      changes: [{ type: 'lookbook.created', lookbookId }],
      lookbook: toLookbook(row),
      sourceInspirationFolders: listLookbookSourceInspirationFolders(session, {
        projectFolder,
        lookbookId,
      }),
      resourceKeys: lookbookResourceKeys(lookbookId),
    };
  });
}

export async function updateLookbook(
  input: UpdateLookbookInput
): Promise<LookbookWriteReport> {
  return withVisualLanguageSession(input, ({ session, projectFolder, project }) => {
    requireLookbookRecordById(session, input.lookbookId);
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    const sections = input.document
      ? serializeLookbookDocument({
          document: input.document,
          filePath: input.filePath,
        })
      : undefined;
    const sourceInspirationFolderIds = input.document?.sourceInspirationFolderIds;
    if (sourceInspirationFolderIds) {
      assertExistingUniqueInspirationFolderIds(session, sourceInspirationFolderIds);
    }
    const now = new Date().toISOString();
    session.db.transaction((tx) => {
      const txSession = { ...session, db: tx };
      updateLookbookRecord(txSession, {
        lookbookId: input.lookbookId,
        name: input.name ? normalizeLookbookName(input.name) : undefined,
        sections,
        now,
      });
      if (sourceInspirationFolderIds) {
        replaceLookbookInspirationRecords(txSession, {
          lookbookId: input.lookbookId,
          inspirationFolderIds: sourceInspirationFolderIds,
          nextId: () => ids('lookbook_inspiration'),
          now,
        });
      }
    });
    return {
      valid: true,
      warnings: [],
      project: toProjectReport(project, projectFolder),
      changes: [{ type: 'lookbook.updated', lookbookId: input.lookbookId }],
      lookbook: toLookbook(requireLookbookRecordById(session, input.lookbookId)),
      sourceInspirationFolders: listLookbookSourceInspirationFolders(session, {
        projectFolder,
        lookbookId: input.lookbookId,
      }),
      resourceKeys: lookbookResourceKeys(input.lookbookId),
    };
  });
}

export async function renameLookbook(
  input: RenameLookbookInput
): Promise<LookbookWriteReport> {
  return updateLookbook({
    projectName: input.projectName,
    homeDir: input.homeDir,
    lookbookId: input.lookbookId,
    name: input.name,
  });
}

export async function deleteLookbook(
  input: DeleteLookbookInput
): Promise<VisualLanguageCommandReport> {
  return withVisualLanguageSession(input, async ({ session, projectFolder, project }) => {
    requireLookbookRecordById(session, input.lookbookId);
    const images = listLookbookImages(session, input.lookbookId);

    for (const image of images) {
      await deleteLookbookImageFiles(projectFolder, image);
    }

    session.db.transaction((tx) => {
      const txSession = { ...session, db: tx };
      if (readActiveLookbookId(txSession) === input.lookbookId) {
        setActiveLookbookRecord(txSession, {
          lookbookId: null,
          now: new Date().toISOString(),
        });
      }
      for (const image of images) {
        deleteLookbookImageRecord(txSession, image.id);
        deleteAssetFileRecordsForAsset(txSession, image.asset.assetId);
        deleteAssetRecord(txSession, image.asset.assetId);
      }
      deleteLookbookRecord(txSession, input.lookbookId);
    });
    return {
      valid: true,
      warnings: [],
      project: toProjectReport(project, projectFolder),
      changes: [{ type: 'lookbook.deleted', lookbookId: input.lookbookId }],
      resourceKeys: lookbookResourceKeys(input.lookbookId),
    };
  });
}

export async function setActiveLookbook(
  input: SetActiveLookbookInput
): Promise<VisualLanguageCommandReport> {
  return withVisualLanguageSession(input, ({ session, projectFolder, project }) => {
    requireLookbookRecordById(session, input.lookbookId);
    setActiveLookbookRecord(session, {
      lookbookId: input.lookbookId,
      now: new Date().toISOString(),
    });
    return {
      valid: true,
      warnings: [],
      project: toProjectReport(project, projectFolder),
      changes: [{ type: 'lookbook.activeSet', lookbookId: input.lookbookId }],
      resourceKeys: lookbookResourceKeys(input.lookbookId),
    };
  });
}

export async function clearActiveLookbook(
  input: ClearActiveLookbookInput
): Promise<VisualLanguageCommandReport> {
  return withVisualLanguageSession(input, ({ session, projectFolder, project }) => {
    const activeLookbookId = readActiveLookbookId(session);
    setActiveLookbookRecord(session, {
      lookbookId: null,
      now: new Date().toISOString(),
    });
    return {
      valid: true,
      warnings: [],
      project: toProjectReport(project, projectFolder),
      changes: [{ type: 'lookbook.activeCleared' }],
      resourceKeys: activeLookbookId
        ? lookbookResourceKeys(activeLookbookId)
        : [lookbookIndexResourceKey],
    };
  });
}

export async function setLookbookSourceInspirations(
  input: SetLookbookSourceInspirationsInput
): Promise<LookbookWriteReport> {
  return withVisualLanguageSession(input, ({ session, projectFolder, project }) => {
    validateLookbookSourceInspirationsDocument(input.filePath, input.document);
    requireLookbookRecordById(session, input.lookbookId);
    assertExistingUniqueInspirationFolderIds(
      session,
      input.document.inspirationFolderIds
    );
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    replaceLookbookInspirationRecords(session, {
      lookbookId: input.lookbookId,
      inspirationFolderIds: input.document.inspirationFolderIds,
      nextId: () => ids('lookbook_inspiration'),
      now: new Date().toISOString(),
    });
    return {
      valid: true,
      warnings: [],
      project: toProjectReport(project, projectFolder),
      changes: [
        { type: 'lookbook.sourceInspirationsSet', lookbookId: input.lookbookId },
      ],
      lookbook: toLookbook(requireLookbookRecordById(session, input.lookbookId)),
      sourceInspirationFolders: listLookbookSourceInspirationFolders(session, {
        projectFolder,
        lookbookId: input.lookbookId,
      }),
      resourceKeys: lookbookResourceKeys(input.lookbookId),
    };
  });
}

export async function listLookbookSourceInspirations(
  input: ListLookbookSourceInspirationsInput
): Promise<LookbookSourceInspirationsReport> {
  return withVisualLanguageSession(input, ({ session, projectFolder, project }) => {
    requireLookbookRecordById(session, input.lookbookId);
    return {
      valid: true,
      warnings: [],
      project: toProjectReport(project, projectFolder),
      lookbookId: input.lookbookId,
      sourceInspirationFolders: listLookbookSourceInspirationFolders(session, {
        projectFolder,
        lookbookId: input.lookbookId,
      }),
      resourceKeys: lookbookResourceKeys(input.lookbookId),
    };
  });
}

export async function setLookbookCardImage(
  input: SetLookbookCardImageInput
): Promise<LookbookImageMutationReport> {
  return withVisualLanguageSession(input, ({ session, projectFolder, project }) => {
    requireLookbookRecordById(session, input.lookbookId);
    const image = requireLookbookImageRecord(session, input.imageId);
    if (image.lookbookId !== input.lookbookId) {
      throw new ProjectDataError(
        'PROJECT_DATA247',
        `Lookbook image ${input.imageId} does not belong to Lookbook ${input.lookbookId}.`
      );
    }
    setLookbookCardImageRecord(session, {
      lookbookId: input.lookbookId,
      imageId: input.imageId,
      now: new Date().toISOString(),
    });
    const lookbookImage = readLookbookImage(session, input.imageId);
    if (!lookbookImage) {
      throw new ProjectDataError(
        'PROJECT_DATA237',
        `Lookbook image was not found: ${input.imageId}.`
      );
    }
    return imageMutationReport({
      project,
      projectFolder,
      lookbookId: input.lookbookId,
      image: lookbookImage,
      changeType: 'lookbook.cardImageSet',
    });
  });
}

export async function clearLookbookCardImage(
  input: { projectName?: string; homeDir?: string; lookbookId: string }
): Promise<LookbookImageMutationReport> {
  return withVisualLanguageSession(input, ({ session, projectFolder, project }) => {
    requireLookbookRecordById(session, input.lookbookId);
    clearLookbookCardImageRecord(session, input.lookbookId);
    return imageMutationReport({
      project,
      projectFolder,
      lookbookId: input.lookbookId,
      changeType: 'lookbook.cardImageCleared',
    });
  });
}

export async function importLookbookImage(
  input: ImportLookbookImageInput
): Promise<LookbookImageMutationReport> {
  return withVisualLanguageSession(input, async ({ session, projectFolder, project }) => {
    requireLookbookRecordById(session, input.lookbookId);

    const sourceProjectRelativePath = normalizeProjectRelativePath(
      input.projectRelativePath
    );
    const sourcePath = resolveProjectRelativePath(
      projectFolder,
      sourceProjectRelativePath
    );
    assertResolvedPathInsideProject(projectFolder, sourcePath);
    const stats = await statExistingFile(sourcePath);

    const destinationProjectRelativePath = await allocateProjectRelativeFilePath({
      projectFolder,
      parent: LOOKBOOK_ROOT,
      fileName: path.basename(sourceProjectRelativePath),
    });
    const destinationPath = resolveProjectRelativePath(
      projectFolder,
      destinationProjectRelativePath
    );
    assertResolvedPathInsideProject(projectFolder, destinationPath);
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    if (sourcePath !== destinationPath) {
      await fs.copyFile(sourcePath, destinationPath);
    }

    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    const now = new Date().toISOString();
    const assetId = ids('asset');
    const imageId = ids('lookbook_image');
    session.db.transaction((tx) => {
      const txSession = { ...session, db: tx };
      insertAssetRecord(txSession, {
        id: assetId,
        type: 'lookbook_image',
        mediaKind: 'image',
        title: input.title?.trim() || path.parse(destinationProjectRelativePath).name,
        oneLineSummary: input.oneLineSummary?.trim() || undefined,
        origin: 'generated',
        availability: 'ready',
        createdAt: now,
        updatedAt: now,
      });
      insertAssetFileRecord(txSession, {
        id: ids('asset_file'),
        assetId,
        role: 'source',
        projectRelativePath: destinationProjectRelativePath,
        mediaKind: 'image',
        sizeBytes: stats.size,
        createdAt: now,
        updatedAt: now,
      });
      insertLookbookImageRecord(txSession, {
        id: imageId,
        lookbookId: input.lookbookId,
        assetId,
        sortOrder: nextLookbookImageSortOrder(txSession, input.lookbookId),
        now,
      });
      setLookbookImageSectionRecords(txSession, {
        imageId,
        sections: assertLookbookSections(input.sections ?? []),
        nextId: () => ids('lookbook_image_section'),
        now,
      });
    });

    const image = readLookbookImage(session, imageId);
    if (!image) {
      throw new ProjectDataError(
        'PROJECT_DATA244',
        `Lookbook image was not imported: ${imageId}.`
      );
    }
    return imageMutationReport({
      project,
      projectFolder,
      lookbookId: input.lookbookId,
      image,
      changeType: 'lookbook.imageImported',
    });
  });
}

export async function setLookbookImageSections(
  input: SetLookbookImageSectionsInput
): Promise<LookbookImageMutationReport> {
  return withVisualLanguageSession(input, ({ session, projectFolder, project }) => {
    const imageRecord = requireLookbookImageRecord(session, input.imageId);
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    setLookbookImageSectionRecords(session, {
      imageId: input.imageId,
      sections: assertLookbookSections(input.sections),
      nextId: () => ids('lookbook_image_section'),
      now: new Date().toISOString(),
    });
    const image = readLookbookImage(session, input.imageId);
    if (!image) {
      throw new ProjectDataError(
        'PROJECT_DATA237',
        `Lookbook image was not found: ${input.imageId}.`
      );
    }
    return imageMutationReport({
      project,
      projectFolder,
      lookbookId: imageRecord.lookbookId,
      image,
      changeType: 'lookbook.imageSectionsSet',
    });
  });
}

export async function deleteLookbookImage(
  input: DeleteLookbookImageInput
): Promise<LookbookImageMutationReport> {
  return withVisualLanguageSession(input, async ({ session, projectFolder, project }) => {
    const image = requireLookbookImageRecord(session, input.imageId);
    const lookbookImage = readLookbookImage(session, input.imageId);
    if (!lookbookImage) {
      throw new ProjectDataError(
        'PROJECT_DATA237',
        `Lookbook image was not found: ${input.imageId}.`
      );
    }
    await deleteLookbookImageFiles(projectFolder, lookbookImage);
    session.db.transaction((tx) => {
      const txSession = { ...session, db: tx };
      deleteLookbookImageRecord(txSession, image.id);
      deleteAssetFileRecordsForAsset(txSession, image.assetId);
      deleteAssetRecord(txSession, image.assetId);
    });
    return imageMutationReport({
      project,
      projectFolder,
      lookbookId: image.lookbookId,
      changeType: 'lookbook.imageDeleted',
    });
  });
}

async function deleteLookbookImageFiles(
  projectFolder: string,
  image: LookbookImage
): Promise<void> {
  for (const file of image.asset.files) {
    const projectRelativePath = normalizeProjectRelativePath(file.projectRelativePath);
    assertProjectRelativeChildPath({
      parent: LOOKBOOK_ROOT,
      child: projectRelativePath,
    });
    await fs.rm(resolveProjectRelativePath(projectFolder, projectRelativePath), {
      force: true,
    });
  }
}

function normalizeLookbookName(name: string): string {
  const normalized = name.trim();
  if (!normalized) {
    throw new ProjectDataError('PROJECT_DATA248', 'Lookbook name is required.');
  }
  return normalized;
}

async function statExistingFile(absolutePath: string): Promise<{ size: number }> {
  try {
    const stats = await fs.stat(absolutePath);
    if (!stats.isFile()) {
      throw new Error('not a regular file');
    }
    return { size: stats.size };
  } catch {
    throw new ProjectDataError(
      'PROJECT_DATA245',
      `Generated Lookbook image file does not exist: ${absolutePath}.`
    );
  }
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

function assertExistingUniqueInspirationFolderIds(
  session: DatabaseSession,
  folderIds: string[]
): void {
  const seen = new Set<string>();
  const duplicateIds = folderIds.filter((folderId) => {
    if (seen.has(folderId)) {
      return true;
    }
    seen.add(folderId);
    return false;
  });
  if (duplicateIds.length > 0) {
    throw new ProjectDataError(
      'PROJECT_DATA249',
      `Lookbook source Inspiration folder ids must be unique: ${duplicateIds.join(', ')}.`
    );
  }
  for (const folderId of folderIds) {
    requireInspirationFolderRecord(session, folderId);
  }
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

function toResolvedInspirationFolder(
  projectFolder: string,
  row: ReturnType<typeof requireInspirationFolderRecord>
) {
  const projectRelativePath = normalizeProjectRelativePath(row.projectRelativePath);
  return {
    id: row.id,
    name: row.name,
    projectRelativePath,
    absolutePath: resolveProjectRelativePath(projectFolder, projectRelativePath),
  };
}

function imageMutationReport(input: {
  project: Pick<ProjectRecord, 'id' | 'name'>;
  projectFolder: string;
  lookbookId: string;
  image?: LookbookImage;
  changeType: string;
}): LookbookImageMutationReport {
  return {
    valid: true,
    warnings: [],
    project: toProjectReport(input.project, input.projectFolder),
    changes: [{ type: input.changeType, lookbookId: input.lookbookId }],
    lookbookId: input.lookbookId,
    ...(input.image ? { image: input.image } : {}),
    resourceKeys: lookbookResourceKeys(input.lookbookId),
  };
}
