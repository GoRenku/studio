import type {
  LookbookImage,
  LookbookImageMutationReport,
  LookbookSheetMutationReport,
  LookbookSourceInspirationsReport,
  LookbookValidationReport,
  LookbookWriteReport,
  VisualLanguageCommandReport,
  VisualLanguageProjectReport,
} from '../../client/index.js';
import {
  clearLookbookCardImageRecord,
  clearLookbookSelectionRecord,
  insertLookbookRecord,
  listStoryboardSourceMovieIdsByLookbookId,
  readSelectedLookbookId,
  readLookbookRecordById,
  requireLookbookRecordById,
  replaceStoryboardLookbookSourceMovieRecords,
  setLookbookSelectionRecord,
  setLookbookCardImageRecord,
  toLookbook,
  updateLookbookRecord,
} from '../database/access/lookbook.js';
import {
  listLookbookSourceInspirationFolders,
  replaceLookbookInspirationRecords,
} from '../database/access/lookbook-inspirations.js';
import {
  readLookbookImage,
  requireLookbookImageRecord,
  setLookbookImageSectionRecords,
} from '../database/access/lookbook-images.js';
import { requireLookbookSheetRecord } from '../database/access/lookbook-sheets.js';
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
  ClearLookbookSelectionInput,
  CreateLookbookInput,
  DeleteLookbookImageInput,
  DeleteLookbookSheetInput,
  DeleteLookbookInput,
  ListLookbookSourceInspirationsInput,
  RenameLookbookInput,
  SelectLookbookForTypeInput,
  SetLookbookCardImageInput,
  SetLookbookImagePlacementInput,
  SetLookbookSourceInspirationsInput,
  UpdateLookbookInput,
  ValidateLookbookInput,
} from '../project-data-service-contracts.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  lookbookTypeFromDocument,
  serializeLookbookDocument,
  validateLookbookDocument,
  validateLookbookSourceInspirationsDocument,
} from '../visual-language-json/validator.js';
import {
  assertLookbookImagePlacementCapacity,
  replaceSingleLookbookImagePlacementSlots,
} from '../lookbook-image-placement-service.js';
import { resolveLookbookImagePlacements } from '../visual-language-json/lookbook-image-placement.js';
import {
  studioVisualLanguageLookbookResourceKey,
  studioVisualLanguageLookbooksResourceKey,
} from '../studio-coordination/resource-keys.js';
import { discardTrashObject } from '../trash/trash-lifecycle-service.js';

const lookbookIndexResourceKey = studioVisualLanguageLookbooksResourceKey();

const lookbookResourceKeys = (lookbookId: string): string[] => [
  lookbookIndexResourceKey,
  studioVisualLanguageLookbookResourceKey(lookbookId),
];

export async function validateLookbook(
  input: ValidateLookbookInput
): Promise<LookbookValidationReport> {
  return withVisualLanguageSession(input, ({ session, projectFolder, project }) => {
    validateLookbookDocument({ document: input.document, filePath: input.filePath });
    const sourceInspirationFolderIds =
      input.document.sourceInspirationFolderIds ?? [];
    assertExistingUniqueInspirationFolderIds(session, sourceInspirationFolderIds);
    if (input.document.kind === 'storyboardLookbook') {
      assertExistingUniqueSourceMovieLookbookIds(
        session,
        input.document.sourceMovieLookbookIds ?? []
      );
    }
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
    const document = serializeLookbookDocument({
      document: input.document,
      filePath: input.filePath,
    });
    const sourceInspirationFolderIds = document.sourceInspirationFolderIds;
    assertExistingUniqueInspirationFolderIds(session, sourceInspirationFolderIds);
    assertExistingUniqueSourceMovieLookbookIds(
      session,
      document.sourceMovieLookbookIds
    );
    const now = new Date().toISOString();
    const lookbookId = ids('lookbook');
    session.db.transaction((tx) => {
      const txSession = { ...session, db: tx };
      insertLookbookRecord(txSession, {
        id: lookbookId,
        name: normalizeLookbookName(input.name ?? document.name),
        type: document.type,
        definitionJson: document.definitionJson,
        now,
      });
      replaceLookbookInspirationRecords(txSession, {
        lookbookId,
        inspirationFolderIds: sourceInspirationFolderIds,
        nextId: () => ids('lookbook_inspiration'),
        now,
      });
      if (document.type === 'storyboard') {
        replaceStoryboardLookbookSourceMovieRecords(txSession, {
          storyboardLookbookId: lookbookId,
          movieLookbookIds: document.sourceMovieLookbookIds,
          now,
        });
      }
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
      lookbook: toLookbook(row, {
        sourceMovieLookbookIds:
          document.type === 'storyboard' ? document.sourceMovieLookbookIds : [],
      }),
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
    const row = requireLookbookRecordById(session, input.lookbookId);
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    const document = input.document
      ? serializeLookbookDocument({
          document: input.document,
          filePath: input.filePath,
        })
      : undefined;
    if (input.document && lookbookTypeFromDocument(input.document) !== row.type) {
      throw new ProjectDataError(
        'CORE_LOOKBOOK_TYPE_MISMATCH',
        `Cannot update ${row.type} Lookbook ${input.lookbookId} with a ${lookbookTypeFromDocument(input.document)} Lookbook document.`
      );
    }
    const sourceInspirationFolderIds = document?.sourceInspirationFolderIds;
    if (sourceInspirationFolderIds) {
      assertExistingUniqueInspirationFolderIds(session, sourceInspirationFolderIds);
    }
    if (document?.sourceMovieLookbookIds) {
      assertExistingUniqueSourceMovieLookbookIds(
        session,
        document.sourceMovieLookbookIds
      );
    }
    const now = new Date().toISOString();
    session.db.transaction((tx) => {
      const txSession = { ...session, db: tx };
      updateLookbookRecord(txSession, {
        lookbookId: input.lookbookId,
        name: input.name
          ? normalizeLookbookName(input.name)
          : document
            ? normalizeLookbookName(document.name)
            : undefined,
        definitionJson: document?.definitionJson,
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
      if (document && row.type === 'storyboard') {
        replaceStoryboardLookbookSourceMovieRecords(txSession, {
          storyboardLookbookId: input.lookbookId,
          movieLookbookIds: document.sourceMovieLookbookIds,
          now,
        });
      }
    });
    const sourceMovieIds =
      row.type === 'storyboard'
        ? listStoryboardSourceMovieIdsByLookbookId(session, [
            input.lookbookId,
          ]).get(input.lookbookId) ?? []
        : [];
    return {
      valid: true,
      warnings: [],
      project: toProjectReport(project, projectFolder),
      changes: [{ type: 'lookbook.updated', lookbookId: input.lookbookId }],
      lookbook: toLookbook(requireLookbookRecordById(session, input.lookbookId), {
        sourceMovieLookbookIds: sourceMovieIds,
      }),
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
  return withVisualLanguageSession(input, ({ session, projectFolder, project }) => {
    requireLookbookRecordById(session, input.lookbookId);
    return discardTrashObject({
      session,
      project,
      projectFolder,
      itemKind: 'lookbook',
      itemId: input.lookbookId,
      commandName: 'lookbook.discard',
      changes: [{ type: 'lookbook.discarded', lookbookId: input.lookbookId }],
    });
  });
}

export async function selectLookbookForType(
  input: SelectLookbookForTypeInput
): Promise<VisualLanguageCommandReport> {
  return withVisualLanguageSession(input, ({ session, projectFolder, project }) => {
    const row = requireLookbookRecordById(session, input.lookbookId);
    if (row.type !== input.type) {
      throw new ProjectDataError(
        'CORE_LOOKBOOK_TYPE_MISMATCH',
        `Cannot select ${row.type} Lookbook ${input.lookbookId} for ${input.type} generation.`
      );
    }
    setLookbookSelectionRecord(session, {
      type: input.type,
      lookbookId: input.lookbookId,
      now: new Date().toISOString(),
    });
    return {
      valid: true,
      warnings: [],
      project: toProjectReport(project, projectFolder),
      changes: [
        {
          type: 'lookbook.selectedForType',
          lookbookId: input.lookbookId,
          lookbookType: input.type,
        },
      ],
      resourceKeys: lookbookResourceKeys(input.lookbookId),
    };
  });
}

export async function clearLookbookSelection(
  input: ClearLookbookSelectionInput
): Promise<VisualLanguageCommandReport> {
  return withVisualLanguageSession(input, ({ session, projectFolder, project }) => {
    const selectedLookbookId = readSelectedLookbookId(session, input.type);
    clearLookbookSelectionRecord(session, input.type);
    return {
      valid: true,
      warnings: [],
      project: toProjectReport(project, projectFolder),
      changes: [{ type: 'lookbook.selectionCleared', lookbookType: input.type }],
      resourceKeys: selectedLookbookId
        ? lookbookResourceKeys(selectedLookbookId)
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
      lookbook: toLookbook(
        requireLookbookRecordById(session, input.lookbookId),
        {
          sourceMovieLookbookIds:
            listStoryboardSourceMovieIdsByLookbookId(session, [
              input.lookbookId,
            ]).get(input.lookbookId) ?? [],
        }
      ),
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

export async function setLookbookImagePlacement(
  input: SetLookbookImagePlacementInput
): Promise<LookbookImageMutationReport> {
  return withVisualLanguageSession(input, ({ session, projectFolder, project }) => {
    const imageRecord = requireLookbookImageRecord(session, input.imageId);
    const lookbookRecord = requireLookbookRecordById(session, imageRecord.lookbookId);
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    const now = new Date().toISOString();
    const placements = resolveLookbookImagePlacements({
      lookbook: lookbookRecord,
      sections: input.sections,
      anchorPointId: input.anchorPointId,
    });
    assertLookbookImagePlacementCapacity(session, {
      lookbookId: imageRecord.lookbookId,
      imageId: input.imageId,
      placements,
    });
    replaceSingleLookbookImagePlacementSlots(session, {
      lookbookId: imageRecord.lookbookId,
      imageId: input.imageId,
      placements,
      now,
    });
    setLookbookImageSectionRecords(session, {
      imageId: input.imageId,
      placements,
      nextId: () => ids('lookbook_image_section'),
      now,
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
      changeType: 'lookbook.imagePlacementSet',
    });
  });
}

export async function deleteLookbookImage(
  input: DeleteLookbookImageInput
): Promise<LookbookImageMutationReport> {
  return withVisualLanguageSession(input, ({ session, projectFolder, project }) => {
    const image = requireLookbookImageRecord(session, input.imageId);
    const report = discardTrashObject({
      session,
      project,
      projectFolder,
      itemKind: 'lookbookImage',
      itemId: input.imageId,
      commandName: 'lookbook.image.discard',
      changes: [
        { type: 'lookbook.imageDiscarded', lookbookId: image.lookbookId },
      ],
    });
    return {
      ...report,
      lookbookId: image.lookbookId,
    };
  });
}

export async function deleteLookbookSheet(
  input: DeleteLookbookSheetInput
): Promise<LookbookSheetMutationReport> {
  return withVisualLanguageSession(input, ({ session, projectFolder, project }) => {
    const sheet = requireLookbookSheetRecord(session, input.sheetId);
    const report = discardTrashObject({
      session,
      project,
      projectFolder,
      itemKind: 'lookbookSheet',
      itemId: input.sheetId,
      commandName: 'lookbook.sheet.discard',
      changes: [
        { type: 'lookbook.sheetDiscarded', lookbookId: sheet.lookbookId },
      ],
    });
    return {
      ...report,
      lookbookId: sheet.lookbookId,
    };
  });
}

function normalizeLookbookName(name: string): string {
  const normalized = name.trim();
  if (!normalized) {
    throw new ProjectDataError('PROJECT_DATA248', 'Lookbook name is required.');
  }
  return normalized;
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

function assertExistingUniqueSourceMovieLookbookIds(
  session: DatabaseSession,
  lookbookIds: string[]
): void {
  const seen = new Set<string>();
  for (const lookbookId of lookbookIds) {
    if (seen.has(lookbookId)) {
      throw new ProjectDataError(
        'PROJECT_DATA246',
        `Duplicate source Movie Lookbook id: ${lookbookId}.`
      );
    }
    seen.add(lookbookId);
    const row = requireLookbookRecordById(session, lookbookId);
    if (row.type !== 'movie') {
      throw new ProjectDataError(
        'CORE_LOOKBOOK_TYPE_MISMATCH',
        `Storyboard Lookbook source ${lookbookId} must be a Movie Lookbook.`
      );
    }
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
