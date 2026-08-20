import { and, eq, isNull } from 'drizzle-orm';
import type { TrashItemKind } from '../../client/index.js';
import {
  assets,
  castVoiceProviderRegistrations,
  castVoices,
  inspirationFolders,
  lookbookImages,
  lookbookSheets,
  sceneDialogueAudioTakes,
} from '../schema/index.js';
import {
  studioAssetOwnerSurfaceResourceKeys,
  studioCastMemberSurfaceResourceKey,
  studioVisualLanguageInspirationFolderResourceKey,
  studioVisualLanguageInspirationResourceKey,
  studioVisualLanguageLookbookResourceKey,
  studioVisualLanguageLookbooksResourceKey,
  studioSceneShotPlansResourceKey,
  projectCoverCandidateResourceKeys,
} from '../studio-coordination/resource-keys.js';
import { shotPlanVideoAssetResourceKeys } from '../shot-plan-video-generations/source-provenance.js';
import { ProjectDataError } from '../project-data-error.js';
import type {
  TrashObjectDefinition,
  TrashObjectDiscardContext,
  TrashObjectResourceKeyContext,
  TrashObjectRestoreContext,
} from './trash-object-definition.js';
import {
  collectAssetFiles,
  markAssetRecordAndFilesDiscarded,
  markAssetTreeDiscarded,
  requireAssetSnapshot,
  restoreAssetRecordAndFiles,
  restoreAssetTree,
} from './asset-tree-lifecycle.js';
import { shotPlanTrashDefinition } from '../shot-plans/trash.js';
import { shotTrashDefinition } from '../shot-plans/shot-trash.js';
import { requireAssetOwner } from '../assets/ownership.js';
import { clearSelectedAssetRecordForAsset } from '../database/access/selected-assets.js';
import { readShotRecord } from '../database/access/shot-plans/shot-records.js';
import { requireShotPlanRecord } from '../database/access/shot-plans/plan-records.js';
import { readAssetRecord } from '../database/access/assets.js';

export function inspirationImageTrashItemId(input: {
  folderId: string;
  fileName: string;
}): string {
  return `${input.folderId}/${input.fileName}`;
}

export function getTrashObjectDefinition(
  itemKind: TrashItemKind
): TrashObjectDefinition {
  const definition = trashObjectDefinitions[itemKind];
  if (!definition) {
    throw new ProjectDataError(
      'PROJECT_DATA265',
      `Trash object kind is not supported: ${itemKind}.`
    );
  }
  return definition;
}

function requireTrashOwnerId(
  input: TrashObjectResourceKeyContext,
  itemKind: TrashItemKind
): string {
  if (input.ownerId) {
    return input.ownerId;
  }
  throw new ProjectDataError(
    'PROJECT_DATA435',
    `Trash ${itemKind} ${input.itemId} is missing its owner id.`
  );
}

const inspirationFolderDefinition: TrashObjectDefinition = {
  itemKind: 'inspirationFolder',
  readTrashItems(input) {
    const folder = input.session.db
      .select()
      .from(inspirationFolders)
      .where(
        and(eq(inspirationFolders.id, input.itemId), isNull(inspirationFolders.discardedAt))
      )
      .get();
    if (!folder) {
      return [];
    }
    return [
      {
        itemKind: 'inspirationFolder',
        itemId: folder.id,
        title: folder.name,
        originalProjectRelativePath: folder.projectRelativePath,
        restoreSnapshot: {
          projectRelativePath: folder.projectRelativePath,
          position: folder.position,
        },
      },
    ];
  },
  applyDiscard(input) {
    input.session.db
      .update(inspirationFolders)
      .set({
        discardedAt: input.now,
        discardOperationId: input.operationId,
        restoredAt: null,
      })
      .where(eq(inspirationFolders.id, input.itemId))
      .run();
  },
  applyRestore(input) {
    input.session.db
      .update(inspirationFolders)
      .set({
        discardedAt: null,
        discardOperationId: null,
        restoredAt: input.now,
      })
      .where(eq(inspirationFolders.id, input.trashItem.itemId))
      .run();
  },
  collectFiles(input) {
    return input.trashItem.originalProjectRelativePath
      ? [
          {
            trashItemId: input.trashItem.id,
            originalProjectRelativePath: input.trashItem.originalProjectRelativePath,
          },
        ]
      : [];
  },
  resourceKeys(input) {
    return [
      studioVisualLanguageInspirationResourceKey(),
      studioVisualLanguageInspirationFolderResourceKey(input.itemId),
    ];
  },
  restoredChanges(input) {
    return [{ type: 'inspirationFolder.restored', folderId: input.itemId }];
  },
};

const inspirationImageDefinition: TrashObjectDefinition = {
  itemKind: 'inspirationImage',
  readTrashItems(input) {
    const [folderId, ...fileNameParts] = input.itemId.split('/');
    const fileName = fileNameParts.join('/');
    if (!folderId || !fileName) {
      throw new ProjectDataError(
        'PROJECT_DATA266',
        `Inspiration image trash id is invalid: ${input.itemId}.`
      );
    }
    const folder = input.session.db
      .select()
      .from(inspirationFolders)
      .where(
        and(eq(inspirationFolders.id, folderId), isNull(inspirationFolders.discardedAt))
      )
      .get();
    if (!folder) {
      return [];
    }
    const originalProjectRelativePath = `${folder.projectRelativePath}/${fileName}`;
    return [
      {
        itemKind: 'inspirationImage',
        itemId: input.itemId,
        ownerKind: 'inspirationFolder',
        ownerId: folderId,
        title: fileName,
        originalProjectRelativePath,
        restoreSnapshot: { folderId, fileName, originalProjectRelativePath },
      },
    ];
  },
  applyDiscard() {
    // Filesystem-only Inspiration images are hidden by the trash ledger.
  },
  applyRestore() {
    // Restoring the trash item is sufficient; the file never moved during discard.
  },
  collectFiles(input) {
    return input.trashItem.originalProjectRelativePath
      ? [
          {
            trashItemId: input.trashItem.id,
            originalProjectRelativePath: input.trashItem.originalProjectRelativePath,
          },
        ]
      : [];
  },
  resourceKeys(input) {
    const folderId = input.itemId.split('/')[0] ?? input.itemId;
    return [
      studioVisualLanguageInspirationResourceKey(),
      studioVisualLanguageInspirationFolderResourceKey(folderId),
    ];
  },
  restoredChanges(input) {
    const [folderId, ...fileNameParts] = input.itemId.split('/');
    return [
      {
        type: 'inspirationImage.restored',
        folderId,
        fileName: fileNameParts.join('/'),
      },
    ];
  },
};

const lookbookImageDefinition: TrashObjectDefinition = {
  itemKind: 'lookbookImage',
  readTrashItems(input) {
    const image = input.session.db
      .select()
      .from(lookbookImages)
      .where(and(eq(lookbookImages.id, input.itemId), isNull(lookbookImages.discardedAt)))
      .get();
    if (!image) {
      return [];
    }
    const owner = requireAssetOwner(input.session, image.assetId);
    if (owner.kind !== 'lookbook') {
      throw new ProjectDataError(
        'CORE_ASSET_STORAGE_INVALID',
        `Lookbook image ${image.id} has invalid Asset ownership.`
      );
    }
    return [
      {
        itemKind: 'lookbookImage',
        itemId: image.id,
        ownerKind: 'lookbook',
        ownerId: owner.id,
        title: image.id,
        restoreSnapshot: {
          lookbookId: owner.id,
          assetId: image.assetId,
          sortOrder: image.sortOrder,
        },
      },
    ];
  },
  applyDiscard(input) {
    markLookbookImageDiscarded(input);
  },
  applyRestore(input) {
    restoreLookbookImage(input);
  },
  collectFiles(input) {
    const snapshot = requireAssetSnapshot(input.snapshot, input.trashItem.id);
    return collectAssetFiles(input, snapshot.assetId);
  },
  resourceKeys(input) {
    return [
      studioVisualLanguageLookbooksResourceKey(),
      studioVisualLanguageLookbookResourceKey(
        requireTrashOwnerId(input, 'lookbookImage')
      ),
    ];
  },
  restoredChanges(input) {
    return [{ type: 'lookbook.imageRestored', imageId: input.itemId }];
  },
};

const lookbookSheetDefinition: TrashObjectDefinition = {
  itemKind: 'lookbookSheet',
  readTrashItems(input) {
    const sheet = input.session.db
      .select()
      .from(lookbookSheets)
      .where(and(eq(lookbookSheets.id, input.itemId), isNull(lookbookSheets.discardedAt)))
      .get();
    if (!sheet) {
      return [];
    }
    const owner = requireAssetOwner(input.session, sheet.assetId);
    if (owner.kind !== 'lookbook') {
      throw new ProjectDataError(
        'CORE_ASSET_STORAGE_INVALID',
        `Lookbook sheet ${sheet.id} has invalid Asset ownership.`
      );
    }
    return [
      {
        itemKind: 'lookbookSheet',
        itemId: sheet.id,
        ownerKind: 'lookbook',
        ownerId: owner.id,
        title: sheet.id,
        restoreSnapshot: {
          lookbookId: owner.id,
          assetId: sheet.assetId,
          sortOrder: sheet.sortOrder,
        },
      },
    ];
  },
  applyDiscard(input) {
    markLookbookSheetDiscarded(input);
  },
  applyRestore(input) {
    restoreLookbookSheet(input);
  },
  collectFiles(input) {
    const snapshot = requireAssetSnapshot(input.snapshot, input.trashItem.id);
    return collectAssetFiles(input, snapshot.assetId);
  },
  resourceKeys(input) {
    return [
      studioVisualLanguageLookbooksResourceKey(),
      studioVisualLanguageLookbookResourceKey(
        requireTrashOwnerId(input, 'lookbookSheet')
      ),
    ];
  },
  restoredChanges(input) {
    return [{ type: 'lookbook.sheetRestored', sheetId: input.itemId }];
  },
};

const assetDefinition: TrashObjectDefinition = {
  itemKind: 'asset',
  readTrashItems(input) {
    const asset = input.session.db
      .select()
      .from(assets)
      .where(and(eq(assets.id, input.itemId), isNull(assets.discardedAt)))
      .get();
    if (!asset) {
      return [];
    }
    return [
      {
        itemKind: 'asset',
        itemId: asset.id,
        title: asset.title,
        restoreSnapshot: {
          assetId: asset.id,
        },
      },
    ];
  },
  applyDiscard(input) {
    markAssetTreeDiscarded(input);
    clearSelectedAssetRecordForAsset(input.session, input.itemId);
  },
  applyRestore(input) {
    restoreAssetTree(input);
  },
  collectFiles(input) {
    return collectAssetFiles(input, input.trashItem.itemId);
  },
  resourceKeys(input) {
    const owner = requireAssetOwner(input.session, input.itemId);
    const asset = readAssetRecord(input.session, input.itemId);
    if (owner.kind === 'project' && asset?.type === 'project_cover') {
      return projectCoverCandidateResourceKeys();
    }
    const videoGenerationKeys = shotPlanVideoAssetResourceKeys(
      input.session,
      input.itemId,
    );
    if (owner.kind !== 'shot') {
      return [
        ...studioAssetOwnerSurfaceResourceKeys(owner),
        ...videoGenerationKeys,
      ];
    }
    const shot = readShotRecord(input.session, owner.id);
    if (!shot) {
      throw new ProjectDataError(
        'CORE_ASSET_STORAGE_INVALID',
        `Shot-owned Asset ${input.itemId} has no Shot: ${owner.id}.`
      );
    }
    return [
      studioSceneShotPlansResourceKey(
        requireShotPlanRecord(input.session, shot.shotPlanId).sceneId
      ),
      ...videoGenerationKeys,
    ];
  },
  restoredChanges(input) {
    return [{ type: 'asset.restored', assetId: input.itemId }];
  },
};

const castVoiceDefinition: TrashObjectDefinition = {
  itemKind: 'castVoice',
  readTrashItems(input) {
    const voice = input.session.db
      .select()
      .from(castVoices)
      .where(and(eq(castVoices.id, input.itemId), isNull(castVoices.discardedAt)))
      .get();
    if (!voice) {
      return [];
    }
    return [
      {
        itemKind: 'castVoice',
        itemId: voice.id,
        ownerKind: 'castMember',
        ownerId: voice.castMemberId,
        title: voice.name,
        restoreSnapshot: {
          castMemberId: voice.castMemberId,
          sampleAssetId: voice.sampleAssetId,
        },
      },
    ];
  },
  applyDiscard(input) {
    const voice = input.session.db
      .select()
      .from(castVoices)
      .where(eq(castVoices.id, input.itemId))
      .get();
    if (!voice) {
      return;
    }
    input.session.db
      .update(castVoices)
      .set({
        discardedAt: input.now,
        discardOperationId: input.operationId,
        restoredAt: null,
      })
      .where(eq(castVoices.id, input.itemId))
      .run();
    input.session.db
      .update(castVoiceProviderRegistrations)
      .set({
        discardedAt: input.now,
        discardOperationId: input.operationId,
        restoredAt: null,
      })
      .where(eq(castVoiceProviderRegistrations.castVoiceId, input.itemId))
      .run();
    markAssetTreeDiscarded({
      ...input,
      itemId: voice.sampleAssetId,
    });
  },
  applyRestore(input) {
    const snapshot = requireCastVoiceSnapshot(input.snapshot, input.trashItem.id);
    input.session.db
      .update(castVoices)
      .set({ discardedAt: null, discardOperationId: null, restoredAt: input.now })
      .where(eq(castVoices.id, input.trashItem.itemId))
      .run();
    input.session.db
      .update(castVoiceProviderRegistrations)
      .set({ discardedAt: null, discardOperationId: null, restoredAt: input.now })
      .where(eq(castVoiceProviderRegistrations.castVoiceId, input.trashItem.itemId))
      .run();
    restoreAssetTree({
      ...input,
      trashItem: { ...input.trashItem, itemId: snapshot.sampleAssetId },
    });
  },
  collectFiles(input) {
    const snapshot = requireCastVoiceSnapshot(input.snapshot, input.trashItem.id);
    return collectAssetFiles(input, snapshot.sampleAssetId);
  },
  resourceKeys(input) {
    return [
      studioCastMemberSurfaceResourceKey(requireTrashOwnerId(input, 'castVoice')),
    ];
  },
  restoredChanges(input) {
    return [{ type: 'castVoice.restored', voiceId: input.itemId }];
  },
};

const sceneDialogueAudioTakeDefinition: TrashObjectDefinition = {
  itemKind: 'sceneDialogueAudioTake',
  readTrashItems(input) {
    const take = input.session.db
      .select()
      .from(sceneDialogueAudioTakes)
      .where(and(eq(sceneDialogueAudioTakes.id, input.itemId), isNull(sceneDialogueAudioTakes.discardedAt)))
      .get();
    if (!take) {
      return [];
    }
    return [
      {
        itemKind: 'sceneDialogueAudioTake',
        itemId: take.id,
        ownerKind: 'sceneDialogueAudio',
        ownerId: take.sceneDialogueAudioId,
        title: take.id,
        restoreSnapshot: {
          sceneDialogueAudioId: take.sceneDialogueAudioId,
          assetId: take.assetId,
        },
      },
    ];
  },
  applyDiscard(input) {
    const take = input.session.db
      .select()
      .from(sceneDialogueAudioTakes)
      .where(eq(sceneDialogueAudioTakes.id, input.itemId))
      .get();
    if (!take) {
      return;
    }
    input.session.db
      .update(sceneDialogueAudioTakes)
      .set({
        discardedAt: input.now,
        discardOperationId: input.operationId,
        restoredAt: null,
        updatedAt: input.now,
      })
      .where(eq(sceneDialogueAudioTakes.id, input.itemId))
      .run();
  },
  applyRestore(input) {
    input.session.db
      .update(sceneDialogueAudioTakes)
      .set({ discardedAt: null, discardOperationId: null, restoredAt: input.now })
      .where(eq(sceneDialogueAudioTakes.id, input.trashItem.itemId))
      .run();
    return [];
  },
  collectFiles(input) {
    const snapshot = requireDialogueTakeSnapshot(input.snapshot, input.trashItem.id);
    return collectAssetFiles(input, snapshot.assetId);
  },
  resourceKeys() {
    return ['trash:list'];
  },
  restoredChanges(input) {
    return [{ type: 'sceneDialogueAudioTake.restored', takeId: input.itemId }];
  },
};

const trashObjectDefinitions: Partial<Record<TrashItemKind, TrashObjectDefinition>> = {
  asset: assetDefinition,
  castVoice: castVoiceDefinition,
  sceneDialogueAudioTake: sceneDialogueAudioTakeDefinition,
  shot: shotTrashDefinition,
  shotPlan: shotPlanTrashDefinition,


  inspirationFolder: inspirationFolderDefinition,
  inspirationImage: inspirationImageDefinition,
  lookbookImage: lookbookImageDefinition,
  lookbookSheet: lookbookSheetDefinition,
};

function markLookbookImageDiscarded(input: TrashObjectDiscardContext): void {
  const image = input.session.db
    .select({ assetId: lookbookImages.assetId })
    .from(lookbookImages)
    .where(eq(lookbookImages.id, input.itemId))
    .get();
  input.session.db
    .update(lookbookImages)
    .set({
      discardedAt: input.now,
      discardOperationId: input.operationId,
      restoredAt: null,
    })
    .where(eq(lookbookImages.id, input.itemId))
    .run();
  if (image) {
    markAssetRecordAndFilesDiscarded({ ...input, itemId: image.assetId });
    clearSelectedAssetRecordForAsset(input.session, image.assetId);
  }
}

function restoreLookbookImage(input: TrashObjectRestoreContext): void {
  const snapshot = requireAssetSnapshot(input.snapshot, input.trashItem.id);
  input.session.db
    .update(lookbookImages)
    .set({ discardedAt: null, discardOperationId: null, restoredAt: input.now })
    .where(eq(lookbookImages.id, input.trashItem.itemId))
    .run();
  restoreAssetRecordAndFiles({
    ...input,
    trashItem: { ...input.trashItem, itemId: snapshot.assetId },
  });
}

function markLookbookSheetDiscarded(input: TrashObjectDiscardContext): void {
  const sheet = input.session.db
    .select({ assetId: lookbookSheets.assetId })
    .from(lookbookSheets)
    .where(eq(lookbookSheets.id, input.itemId))
    .get();
  input.session.db
    .update(lookbookSheets)
    .set({
      discardedAt: input.now,
      discardOperationId: input.operationId,
      restoredAt: null,
    })
    .where(eq(lookbookSheets.id, input.itemId))
    .run();
  if (sheet) {
    markAssetRecordAndFilesDiscarded({ ...input, itemId: sheet.assetId });
  }
}

function restoreLookbookSheet(input: TrashObjectRestoreContext): void {
  const snapshot = requireAssetSnapshot(input.snapshot, input.trashItem.id);
  input.session.db
    .update(lookbookSheets)
    .set({ discardedAt: null, discardOperationId: null, restoredAt: input.now })
    .where(eq(lookbookSheets.id, input.trashItem.itemId))
    .run();
  restoreAssetRecordAndFiles({
    ...input,
    trashItem: { ...input.trashItem, itemId: snapshot.assetId },
  });
}

function requireCastVoiceSnapshot(
  snapshot: Record<string, unknown>,
  trashItemId: string
): { castMemberId: string; sampleAssetId: string } {
  if (
    typeof snapshot.castMemberId === 'string' &&
    typeof snapshot.sampleAssetId === 'string'
  ) {
    return {
      castMemberId: snapshot.castMemberId,
      sampleAssetId: snapshot.sampleAssetId,
    };
  }
  throw new ProjectDataError(
    'PROJECT_DATA269',
    `Cast Voice trash item snapshot is invalid: ${trashItemId}.`
  );
}

function requireDialogueTakeSnapshot(
  snapshot: Record<string, unknown>,
  trashItemId: string
): { sceneDialogueAudioId: string; assetId: string } {
  if (
    typeof snapshot.sceneDialogueAudioId === 'string' &&
    typeof snapshot.assetId === 'string'
  ) {
    return {
      sceneDialogueAudioId: snapshot.sceneDialogueAudioId,
      assetId: snapshot.assetId,
    };
  }
  throw new ProjectDataError(
    'PROJECT_DATA270',
    `Scene Dialogue Audio take trash item snapshot is invalid: ${trashItemId}.`
  );
}
