import type {
  LookbookImage,
  LookbookImageMutationReport,
  LookbookSheetMutationReport,
  LookbookSourceInspirationsReport,
  LookbookWriteReport,
  VisualLanguageProjectReport,
} from '../../client/index.js';
import { requireLookbookRecordById, toLookbook } from '../database/access/lookbook.js';
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
import type {
  DeleteLookbookImageInput,
  DeleteLookbookSheetInput,
  ListLookbookSourceInspirationsInput,
  SetLookbookImagePlacementInput,
  SetLookbookSourceInspirationsInput,
} from '../project-data-service-contracts.js';
import { ProjectDataError } from '../project-data-error.js';
import { validateLookbookSourceInspirationsDocument } from '../visual-language-json/validator.js';
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
import { requireAssetOwner } from '../assets/ownership.js';

const lookbookIndexResourceKey = studioVisualLanguageLookbooksResourceKey();

const lookbookResourceKeys = (lookbookId: string): string[] => [
  lookbookIndexResourceKey,
  studioVisualLanguageLookbookResourceKey(lookbookId),
];

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

export async function setLookbookImagePlacement(
  input: SetLookbookImagePlacementInput
): Promise<LookbookImageMutationReport> {
  return withVisualLanguageSession(input, ({ session, projectFolder, project }) => {
    const imageRecord = requireLookbookImageRecord(session, input.imageId);
    const lookbookId = requireLookbookOwnerId(session, imageRecord.assetId);
    const lookbookRecord = requireLookbookRecordById(session, lookbookId);
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    const now = new Date().toISOString();
    const placements = resolveLookbookImagePlacements({
      lookbook: lookbookRecord,
      sections: input.sections,
      anchorPointId: input.anchorPointId,
    });
    assertLookbookImagePlacementCapacity(session, {
      lookbookId,
      imageId: input.imageId,
      placements,
    });
    replaceSingleLookbookImagePlacementSlots(session, {
      lookbookId,
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
      lookbookId,
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
    const lookbookId = requireLookbookOwnerId(session, image.assetId);
    const report = discardTrashObject({
      session,
      project,
      projectFolder,
      itemKind: 'lookbookImage',
      itemId: input.imageId,
      commandName: 'lookbook.image.discard',
      changes: [
        { type: 'lookbook.imageDiscarded', lookbookId },
      ],
    });
    return {
      ...report,
      lookbookId,
    };
  });
}

export async function deleteLookbookSheet(
  input: DeleteLookbookSheetInput
): Promise<LookbookSheetMutationReport> {
  return withVisualLanguageSession(input, ({ session, projectFolder, project }) => {
    const sheet = requireLookbookSheetRecord(session, input.sheetId);
    const lookbookId = requireLookbookOwnerId(session, sheet.assetId);
    const report = discardTrashObject({
      session,
      project,
      projectFolder,
      itemKind: 'lookbookSheet',
      itemId: input.sheetId,
      commandName: 'lookbook.sheet.discard',
      changes: [
        { type: 'lookbook.sheetDiscarded', lookbookId },
      ],
    });
    return {
      ...report,
      lookbookId,
    };
  });
}

function requireLookbookOwnerId(
  session: DatabaseSession,
  assetId: string
): string {
  const owner = requireAssetOwner(session, assetId);
  if (owner.kind !== 'lookbook') {
    throw new ProjectDataError(
      'CORE_ASSET_STORAGE_INVALID',
      `Lookbook detail Asset has invalid ownership: ${assetId}.`
    );
  }
  return owner.id;
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
