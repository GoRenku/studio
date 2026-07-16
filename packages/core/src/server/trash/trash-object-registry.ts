import {
  createDiagnosticError,
  createDiagnosticWarning,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import { and, eq, isNull, ne } from 'drizzle-orm';
import type { AssetTarget, TrashItemKind } from '../../client/index.js';
import {
  discardAssetRelationshipRecord,
  readAssetOwnerTargets,
  readAssetRelationshipRecord,
  restoreAssetRelationshipRecord,
} from '../database/access/asset-relationships/index.js';
import {
  assetFiles,
  assets,
  castAssets,
  castVoiceProviderRegistrations,
  castVoices,
  inspirationFolders,
  locationAssets,
  lookbookCardImages,
  lookbookImages,
  lookbookSheets,
  projectAssets,
  sceneAssets,
  sceneDialogueAudioTakes,
  sceneShotVideoTakeImages,
  sceneShotReferenceAssets,
  sceneShotVideoTakeVideos,
  sceneShotVideoTakeShots,
  sceneShotVideoTakes,
  sequenceAssets,
} from '../schema/index.js';
import {
  studioCastMemberAssetsResourceKey,
  studioVisualLanguageInspirationFolderResourceKey,
  studioVisualLanguageInspirationResourceKey,
  studioVisualLanguageLookbookResourceKey,
  studioVisualLanguageLookbooksResourceKey,
} from '../studio-coordination/resource-keys.js';
import { ProjectDataError } from '../project-data-error.js';
import { countActiveSceneShotReferenceAssetOwners } from '../database/access/scene-shot-reference-assets.js';
import {
  countActiveSceneShotVideoTakeMediaOwners,
  listActiveSceneShotVideoTakeOwnedMedia,
  listSceneShotVideoTakeOwnedMediaConflicts,
  type SceneShotVideoTakeOwnedMediaConflict,
} from '../database/access/shot-video-take-media.js';
import type {
  TrashFileDraft,
  TrashObjectDefinition,
  TrashObjectDiscardContext,
  TrashObjectGarbageCollectionContext,
  TrashObjectResourceKeyContext,
  TrashObjectRestoreContext,
} from './trash-object-definition.js';

export function inspirationImageTrashItemId(input: {
  folderId: string;
  fileName: string;
}): string {
  return `${input.folderId}/${input.fileName}`;
}

export function assetRelationshipTrashItemId(input: {
  target: AssetTarget;
  assetId: string;
}): string {
  return [
    input.assetId,
    input.target.kind,
    assetTargetId(input.target) ?? '',
  ]
    .map(encodeURIComponent)
    .join('/');
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
    return [
      {
        itemKind: 'lookbookImage',
        itemId: image.id,
        ownerKind: 'lookbook',
        ownerId: image.lookbookId,
        title: image.id,
        restoreSnapshot: {
          lookbookId: image.lookbookId,
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
    return [
      {
        itemKind: 'lookbookSheet',
        itemId: sheet.id,
        ownerKind: 'lookbook',
        ownerId: sheet.lookbookId,
        title: sheet.id,
        restoreSnapshot: {
          lookbookId: sheet.lookbookId,
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
  },
  applyRestore(input) {
    restoreAssetTree(input);
  },
  collectFiles(input) {
    return collectAssetFiles(input, input.trashItem.itemId);
  },
  resourceKeys() {
    return ['assets:list'];
  },
  restoredChanges(input) {
    return [{ type: 'asset.restored', assetId: input.itemId }];
  },
};

const assetRelationshipDefinition: TrashObjectDefinition = {
  itemKind: 'assetRelationship',
  readTrashItems(input) {
    const parsed = parseAssetRelationshipTrashItemId(input.itemId);
    const relationship = readAssetRelationshipRecord(input.session, parsed);
    if (!relationship) {
      return [];
    }
    const activeOwnerCount = readAssetOwnerTargets(
      input.session,
      parsed.assetId
    ).length;
    return [
      {
        itemKind: 'assetRelationship',
        itemId: input.itemId,
        ownerKind: parsed.target.kind,
        ownerId: assetTargetId(parsed.target),
        title: relationship.title,
        restoreSnapshot: {
          assetId: parsed.assetId,
          target: parsed.target,
          discardedAsset: activeOwnerCount <= 1,
        },
      },
    ];
  },
  applyDiscard(input) {
    const parsed = parseAssetRelationshipTrashItemId(input.itemId);
    const activeOwnerCount = readAssetOwnerTargets(
      input.session,
      parsed.assetId
    ).length;
    discardAssetRelationshipRecord(input.session, {
      target: parsed.target,
      assetId: parsed.assetId,
      operationId: input.operationId,
      now: input.now,
    });
    if (activeOwnerCount <= 1) {
      markAssetRecordAndFilesDiscarded({
        ...input,
        itemId: parsed.assetId,
      });
    }
  },
  applyRestore(input) {
    const snapshot = requireAssetRelationshipSnapshot(
      input.snapshot,
      input.trashItem.id
    );
    if (snapshot.discardedAsset) {
      restoreAssetRecordAndFiles({
        ...input,
        trashItem: { ...input.trashItem, itemId: snapshot.assetId },
      });
    }
    restoreAssetRelationshipRecord(input.session, {
      target: snapshot.target,
      assetId: snapshot.assetId,
      now: input.now,
    });
  },
  collectFiles(input) {
    const snapshot = requireAssetRelationshipSnapshot(
      input.snapshot,
      input.trashItem.id
    );
    return snapshot.discardedAsset ? collectAssetFiles(input, snapshot.assetId) : [];
  },
  resourceKeys() {
    return ['assets:list'];
  },
  restoredChanges(input) {
    const parsed = parseAssetRelationshipTrashItemId(input.itemId);
    return [{ type: 'assetRelationship.restored', assetId: parsed.assetId }];
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
      studioCastMemberAssetsResourceKey(requireTrashOwnerId(input, 'castVoice')),
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

const sceneShotVideoTakeDefinition: TrashObjectDefinition = {
  itemKind: 'sceneShotVideoTake',
  readTrashItems(input) {
    const take = input.session.db
      .select()
      .from(sceneShotVideoTakes)
      .where(
        and(
          eq(sceneShotVideoTakes.id, input.itemId),
          isNull(sceneShotVideoTakes.discardedAt)
        )
      )
      .get();
    if (!take) {
      return [];
    }
    const ownedAssetIds = listExclusiveSceneShotVideoTakeOwnedAssetIds(
      input,
      take.id
    );
    return [
      {
        itemKind: 'sceneShotVideoTake',
        itemId: take.id,
        ownerKind: 'scene',
        ownerId: take.sceneId,
        title: take.title,
        restoreSnapshot: {
          sceneId: take.sceneId,
          wasPicked: take.isPicked,
          ownedAssetIds,
        },
      },
    ];
  },
  applyDiscard(input) {
    const take = input.session.db
      .select()
      .from(sceneShotVideoTakes)
      .where(eq(sceneShotVideoTakes.id, input.itemId))
      .get();
    if (!take) {
      return;
    }
    const ownedAssetIds = listExclusiveSceneShotVideoTakeOwnedAssetIds(
      input,
      input.itemId
    );
    input.session.db
      .update(sceneShotVideoTakes)
      .set({
        discardedAt: input.now,
        discardOperationId: input.operationId,
        restoredAt: null,
        isPicked: false,
        updatedAt: input.now,
      })
      .where(eq(sceneShotVideoTakes.id, input.itemId))
      .run();
    input.session.db
      .update(sceneShotVideoTakeShots)
      .set({
        discardedAt: input.now,
        discardOperationId: input.operationId,
        restoredAt: null,
      })
      .where(eq(sceneShotVideoTakeShots.takeId, input.itemId))
      .run();
    input.session.db
      .update(sceneShotVideoTakeImages)
      .set({
        discardedAt: input.now,
        discardOperationId: input.operationId,
        restoredAt: null,
        updatedAt: input.now,
      })
      .where(eq(sceneShotVideoTakeImages.takeId, input.itemId))
      .run();
    input.session.db
      .update(sceneShotVideoTakeVideos)
      .set({
        discardedAt: input.now,
        discardOperationId: input.operationId,
        restoredAt: null,
        updatedAt: input.now,
      })
      .where(eq(sceneShotVideoTakeVideos.takeId, input.itemId))
      .run();
    ownedAssetIds.forEach((assetId) =>
      markAssetRecordAndFilesDiscarded({ ...input, itemId: assetId })
    );
  },
  applyRestore(input) {
    const snapshot = requireSceneShotVideoTakeSnapshot(
      input.snapshot,
      input.trashItem.id
    );
    const warnings: DiagnosticIssue[] = [];
    const restoredPick = shouldRestoreSceneShotVideoTakePick(input, snapshot);
    input.session.db
      .update(sceneShotVideoTakes)
      .set({
        discardedAt: null,
        discardOperationId: null,
        restoredAt: input.now,
        isPicked: restoredPick,
        updatedAt: input.now,
      })
      .where(eq(sceneShotVideoTakes.id, input.trashItem.itemId))
      .run();
    if (snapshot.wasPicked && !restoredPick) {
      warnings.push(
        restoreConflictWarning({
          path: ['trashItem', input.trashItem.id, 'isPicked'],
          message:
            'The restored Scene Shot Video Take was not made picked because another active take is picked.',
          suggestion:
            'Review the active picked take before changing the scene take pick.',
        })
      );
    }
    input.session.db
      .update(sceneShotVideoTakeShots)
      .set({ discardedAt: null, discardOperationId: null, restoredAt: input.now })
      .where(eq(sceneShotVideoTakeShots.takeId, input.trashItem.itemId))
      .run();
    input.session.db
      .update(sceneShotVideoTakeImages)
      .set({
        discardedAt: null,
        discardOperationId: null,
        restoredAt: input.now,
        updatedAt: input.now,
      })
      .where(eq(sceneShotVideoTakeImages.takeId, input.trashItem.itemId))
      .run();
    input.session.db
      .update(sceneShotVideoTakeVideos)
      .set({
        discardedAt: null,
        discardOperationId: null,
        restoredAt: input.now,
        updatedAt: input.now,
      })
      .where(eq(sceneShotVideoTakeVideos.takeId, input.trashItem.itemId))
      .run();
    snapshot.ownedAssetIds.forEach((assetId) =>
      restoreAssetRecordAndFiles({
        ...input,
        trashItem: { ...input.trashItem, itemId: assetId },
      })
    );
    return warnings;
  },
  collectFiles(input) {
    const snapshot = requireSceneShotVideoTakeSnapshot(
      input.snapshot,
      input.trashItem.id
    );
    return snapshot.ownedAssetIds.flatMap((assetId) =>
      collectAssetFiles(input, assetId)
    );
  },
  resourceKeys() {
    return ['trash:list'];
  },
  restoredChanges(input) {
    return [{ type: 'sceneShotVideoTake.restored', takeId: input.itemId }];
  },
};

const sceneShotReferenceAssetDefinition: TrashObjectDefinition = {
  itemKind: 'sceneShotReferenceAsset',
  readTrashItems(input) {
    const relationship = input.session.db
      .select({
        id: sceneShotReferenceAssets.id,
        sceneId: sceneShotReferenceAssets.sceneId,
        shotListId: sceneShotReferenceAssets.shotListId,
        shotId: sceneShotReferenceAssets.shotId,
        assetId: sceneShotReferenceAssets.assetId,
        assetFileId: sceneShotReferenceAssets.assetFileId,
        sortOrder: sceneShotReferenceAssets.sortOrder,
        title: assets.title,
      })
      .from(sceneShotReferenceAssets)
      .innerJoin(assets, eq(sceneShotReferenceAssets.assetId, assets.id))
      .where(and(
        eq(sceneShotReferenceAssets.id, input.itemId),
        isNull(sceneShotReferenceAssets.discardedAt)
      ))
      .get();
    if (!relationship) {
      return [];
    }
    return [{
      itemKind: 'sceneShotReferenceAsset',
      itemId: relationship.id,
      ownerKind: 'sceneShot',
      ownerId: relationship.shotId,
      title: relationship.title,
      restoreSnapshot: {
        sceneId: relationship.sceneId,
        shotListId: relationship.shotListId,
        shotId: relationship.shotId,
        assetId: relationship.assetId,
        assetFileId: relationship.assetFileId,
        sortOrder: relationship.sortOrder,
      },
    }];
  },
  applyDiscard(input) {
    input.session.db
      .update(sceneShotReferenceAssets)
      .set({
        discardedAt: input.now,
        discardOperationId: input.operationId,
        restoredAt: null,
        updatedAt: input.now,
      })
      .where(eq(sceneShotReferenceAssets.id, input.itemId))
      .run();
  },
  applyRestore(input) {
    input.session.db
      .update(sceneShotReferenceAssets)
      .set({
        discardedAt: null,
        discardOperationId: null,
        restoredAt: input.now,
        updatedAt: input.now,
      })
      .where(eq(sceneShotReferenceAssets.id, input.trashItem.itemId))
      .run();
  },
  collectFiles() {
    return [];
  },
  resourceKeys(input) {
    return ['trash:list', `scene-shot:${input.ownerId ?? ''}`];
  },
  restoredChanges(input) {
    return [{
      type: 'sceneShotReferenceAsset.restored',
      relationshipId: input.itemId,
    }];
  },
};

const unsupportedKinds = new Set<TrashItemKind>();

const trashObjectDefinitions: Partial<Record<TrashItemKind, TrashObjectDefinition>> = {
  asset: assetDefinition,
  assetRelationship: assetRelationshipDefinition,
  castVoice: castVoiceDefinition,
  sceneDialogueAudioTake: sceneDialogueAudioTakeDefinition,
  sceneShotReferenceAsset: sceneShotReferenceAssetDefinition,
  sceneShotVideoTake: sceneShotVideoTakeDefinition,
  inspirationFolder: inspirationFolderDefinition,
  inspirationImage: inspirationImageDefinition,
  lookbookImage: lookbookImageDefinition,
  lookbookSheet: lookbookSheetDefinition,
};

for (const kind of unsupportedKinds) {
  trashObjectDefinitions[kind] = unsupportedDefinition(kind);
}

function unsupportedDefinition(kind: TrashItemKind): TrashObjectDefinition {
  return {
    itemKind: kind,
    readTrashItems() {
      throw new ProjectDataError(
        'PROJECT_DATA267',
        `Trash object kind is registered but not implemented yet: ${kind}.`
      );
    },
    applyDiscard() {},
    applyRestore() {},
    collectFiles() {
      return [];
    },
    resourceKeys() {
      return ['trash:list'];
    },
    restoredChanges(input) {
      return [{ type: 'trash.restored', itemKind: kind, itemId: input.itemId }];
    },
  };
}

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
  input.session.db
    .update(lookbookCardImages)
    .set({
      discardedAt: input.now,
      discardOperationId: input.operationId,
      restoredAt: null,
    })
      .where(eq(lookbookCardImages.imageId, input.itemId))
    .run();
  if (image && readAssetOwnerTargets(input.session, image.assetId).length === 0) {
    markAssetRecordAndFilesDiscarded({ ...input, itemId: image.assetId });
  }
}

function restoreLookbookImage(input: TrashObjectRestoreContext): void {
  const snapshot = requireAssetSnapshot(input.snapshot, input.trashItem.id);
  input.session.db
    .update(lookbookImages)
    .set({ discardedAt: null, discardOperationId: null, restoredAt: input.now })
    .where(eq(lookbookImages.id, input.trashItem.itemId))
    .run();
  input.session.db
    .update(lookbookCardImages)
    .set({ discardedAt: null, discardOperationId: null, restoredAt: input.now })
    .where(eq(lookbookCardImages.imageId, input.trashItem.itemId))
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
  if (sheet && readAssetOwnerTargets(input.session, sheet.assetId).length === 0) {
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

function collectAssetFiles(
  input: TrashObjectGarbageCollectionContext,
  assetId: string
): TrashFileDraft[] {
  const asset = input.session.db
    .select({ discardedAt: assets.discardedAt })
    .from(assets)
    .where(eq(assets.id, assetId))
    .get();
  if (!asset) {
    throw new ProjectDataError(
      'PROJECT_DATA277',
      `Trash garbage collection could not find asset: ${assetId}.`
    );
  }
  const activeOwners = countActiveAssetOwners(input.session, assetId);
  if (!asset.discardedAt) {
    if (activeOwners > 0) {
      return [];
    }
    throw garbageCollectionBlocker({
      trashItemId: input.trashItem.id,
      assetId,
      message:
        'Trash garbage collection cannot collect an active asset row.',
      suggestion:
        'Discard the asset through its owning domain command before emptying Trash.',
    });
  }
  if (activeOwners > 0) {
    throw garbageCollectionBlocker({
      trashItemId: input.trashItem.id,
      assetId,
      message:
        'Trash garbage collection cannot collect an asset while it still has active owners.',
      suggestion:
        'Discard or detach every active owner before emptying Trash.',
    });
  }
  const files = input.session.db
    .select()
    .from(assetFiles)
    .where(eq(assetFiles.assetId, assetId))
    .all();
  for (const file of files) {
    const activePathOwner = readActiveAssetFilePathOwner(input.session, {
      assetId,
      projectRelativePath: file.projectRelativePath,
    });
    if (activePathOwner) {
      throw garbageCollectionBlocker({
        trashItemId: input.trashItem.id,
        assetId,
        message:
          `Trash garbage collection cannot collect ${file.projectRelativePath} because active asset ${activePathOwner.assetId} owns that path.`,
        suggestion:
          'Move or discard the active asset file before emptying Trash.',
      });
    }
  }
  return files.map((file) => ({
    trashItemId: input.trashItem.id,
    originalProjectRelativePath: file.projectRelativePath,
  }));
}

function readActiveAssetFilePathOwner(
  session: TrashObjectGarbageCollectionContext['session'],
  input: { assetId: string; projectRelativePath: string }
): { assetId: string; assetFileId: string } | null {
  return session.db
    .select({ assetId: assetFiles.assetId, assetFileId: assetFiles.id })
    .from(assetFiles)
    .innerJoin(assets, eq(assetFiles.assetId, assets.id))
    .where(
      and(
        eq(assetFiles.projectRelativePath, input.projectRelativePath),
        ne(assetFiles.assetId, input.assetId),
        isNull(assetFiles.discardedAt),
        isNull(assets.discardedAt)
      )
    )
    .get() ?? null;
}

function countActiveAssetOwners(
  session: TrashObjectGarbageCollectionContext['session'],
  assetId: string
): number {
  const relationshipOwners = [
    projectAssets,
    castAssets,
    locationAssets,
    sequenceAssets,
    sceneAssets,
  ].reduce((total, table) => {
    const rows = session.db
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.assetId, assetId), isNull(table.discardedAt)))
      .all();
    return total + rows.length;
  }, 0);
  return relationshipOwners +
    countActiveSceneShotVideoTakeMediaOwners(session, assetId) +
    countActiveSceneShotReferenceAssetOwners(session, assetId);
}

function assetTargetId(target: AssetTarget): string | null {
  switch (target.kind) {
    case 'project':
      return null;
    case 'castMember':
      return target.castMemberId;
    case 'location':
      return target.locationId;
    case 'sequence':
      return target.sequenceId;
    case 'scene':
      return target.sceneId;
  }
}

function parseAssetRelationshipTrashItemId(itemId: string): {
  assetId: string;
  target: AssetTarget;
} {
  const [assetIdPart, kindPart, targetIdPart = ''] = itemId.split('/');
  const assetId = assetIdPart ? decodeURIComponent(assetIdPart) : '';
  const kind = kindPart ? decodeURIComponent(kindPart) : '';
  const targetId = decodeURIComponent(targetIdPart);
  if (!assetId) {
    throw new ProjectDataError(
      'PROJECT_DATA272',
      `Asset relationship trash id is missing asset id: ${itemId}.`
    );
  }
  switch (kind) {
    case 'project':
      return { assetId, target: { kind } };
    case 'castMember':
      assertAssetRelationshipTargetId(itemId, targetId);
      return { assetId, target: { kind, castMemberId: targetId } };
    case 'location':
      assertAssetRelationshipTargetId(itemId, targetId);
      return { assetId, target: { kind, locationId: targetId } };
    case 'sequence':
      assertAssetRelationshipTargetId(itemId, targetId);
      return { assetId, target: { kind, sequenceId: targetId } };
    case 'scene':
      assertAssetRelationshipTargetId(itemId, targetId);
      return { assetId, target: { kind, sceneId: targetId } };
    default:
      throw new ProjectDataError(
        'PROJECT_DATA273',
        `Asset relationship trash target is invalid: ${itemId}.`
      );
  }
}

function assertAssetRelationshipTargetId(itemId: string, targetId: string): void {
  if (targetId) {
    return;
  }
  throw new ProjectDataError(
    'PROJECT_DATA275',
    `Asset relationship trash id is missing target id: ${itemId}.`
  );
}

function listExclusiveSceneShotVideoTakeOwnedAssetIds(
  input: TrashObjectDiscardContext,
  takeId: string
): string[] {
  const ownedMedia = listActiveSceneShotVideoTakeOwnedMedia(
    input.session,
    takeId
  );
  const conflicts = listSceneShotVideoTakeOwnedMediaConflicts({
    session: input.session,
    takeId,
    media: ownedMedia,
  });
  if (conflicts.length > 0) {
    throw sharedTakeOwnedMediaError(conflicts);
  }
  return [...new Set(ownedMedia.map((row) => row.assetId))];
}

function sharedTakeOwnedMediaError(
  conflicts: SceneShotVideoTakeOwnedMediaConflict[]
): ProjectDataError {
  return new ProjectDataError(
    'PROJECT_DATA440',
    `Shot video take-owned media is shared with another active owner: ${conflicts.map((conflict) => `${conflict.assetId}/${conflict.assetFileId} (${conflict.owner})`).join(', ')}.`,
    {
      suggestion:
        'Attach distinct media to every active owner before deleting this Take.',
    }
  );
}

function shouldRestoreSceneShotVideoTakePick(
  input: TrashObjectRestoreContext,
  snapshot: { sceneId: string; wasPicked: boolean }
): boolean {
  if (!snapshot.wasPicked) {
    return false;
  }
  const activePickedTake = input.session.db
    .select({ id: sceneShotVideoTakes.id })
    .from(sceneShotVideoTakes)
    .where(
      and(
        eq(sceneShotVideoTakes.sceneId, snapshot.sceneId),
        eq(sceneShotVideoTakes.isPicked, true),
        isNull(sceneShotVideoTakes.discardedAt)
      )
    )
    .get();
  return !activePickedTake;
}

function markAssetTreeDiscarded(input: TrashObjectDiscardContext): void {
  markAssetRecordAndFilesDiscarded(input);
  for (const table of [
    projectAssets,
    castAssets,
    locationAssets,
    sequenceAssets,
    sceneAssets,
  ]) {
    input.session.db
      .update(table)
      .set({
        discardedAt: input.now,
        discardOperationId: input.operationId,
        restoredAt: null,
      })
      .where(eq(table.assetId, input.itemId))
      .run();
  }
}

function markAssetRecordAndFilesDiscarded(
  input: TrashObjectDiscardContext
): void {
  input.session.db
    .update(assets)
    .set({
      discardedAt: input.now,
      discardOperationId: input.operationId,
      restoredAt: null,
    })
    .where(eq(assets.id, input.itemId))
    .run();
  input.session.db
    .update(assetFiles)
    .set({
      discardedAt: input.now,
      discardOperationId: input.operationId,
      restoredAt: null,
    })
    .where(eq(assetFiles.assetId, input.itemId))
    .run();
}

function restoreAssetTree(input: TrashObjectRestoreContext): void {
  restoreAssetRecordAndFiles(input);
  for (const table of [
    projectAssets,
    castAssets,
    locationAssets,
    sequenceAssets,
    sceneAssets,
  ]) {
    input.session.db
      .update(table)
      .set({ discardedAt: null, discardOperationId: null, restoredAt: input.now })
      .where(eq(table.assetId, input.trashItem.itemId))
      .run();
  }
}

function restoreAssetRecordAndFiles(input: TrashObjectRestoreContext): void {
  const assetId = input.trashItem.itemId;
  input.session.db
    .update(assets)
    .set({ discardedAt: null, discardOperationId: null, restoredAt: input.now })
    .where(eq(assets.id, assetId))
    .run();
  input.session.db
    .update(assetFiles)
    .set({ discardedAt: null, discardOperationId: null, restoredAt: input.now })
    .where(eq(assetFiles.assetId, assetId))
    .run();
}

function requireAssetSnapshot(
  snapshot: Record<string, unknown>,
  trashItemId: string
): { assetId: string } {
  if (typeof snapshot.assetId === 'string') {
    return { assetId: snapshot.assetId };
  }
  throw new ProjectDataError(
    'PROJECT_DATA268',
    `Trash item snapshot is missing asset id: ${trashItemId}.`
  );
}

function requireAssetRelationshipSnapshot(
  snapshot: Record<string, unknown>,
  trashItemId: string
): { assetId: string; target: AssetTarget; discardedAsset: boolean } {
  if (
    typeof snapshot.assetId === 'string' &&
    typeof snapshot.discardedAsset === 'boolean' &&
    isAssetTarget(snapshot.target)
  ) {
    return {
      assetId: snapshot.assetId,
      target: snapshot.target,
      discardedAsset: snapshot.discardedAsset,
    };
  }
  throw new ProjectDataError(
    'PROJECT_DATA274',
    `Asset relationship trash item snapshot is invalid: ${trashItemId}.`
  );
}

function isAssetTarget(value: unknown): value is AssetTarget {
  if (!value || typeof value !== 'object' || !('kind' in value)) {
    return false;
  }
  const target = value as Record<string, unknown>;
  switch (target.kind) {
    case 'project':
      return true;
    case 'castMember':
      return typeof target.castMemberId === 'string';
    case 'location':
      return typeof target.locationId === 'string';
    case 'sequence':
      return typeof target.sequenceId === 'string';
    case 'scene':
      return typeof target.sceneId === 'string';
    default:
      return false;
  }
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

function requireSceneShotVideoTakeSnapshot(
  snapshot: Record<string, unknown>,
  trashItemId: string
): { sceneId: string; wasPicked: boolean; ownedAssetIds: string[] } {
  if (
    typeof snapshot.sceneId === 'string' &&
    typeof snapshot.wasPicked === 'boolean' &&
    isStringArray(snapshot.ownedAssetIds)
  ) {
    return {
      sceneId: snapshot.sceneId,
      wasPicked: snapshot.wasPicked,
      ownedAssetIds: [...snapshot.ownedAssetIds],
    };
  }
  throw new ProjectDataError(
    'PROJECT_DATA271',
    `Scene Shot Video Take trash item snapshot is invalid: ${trashItemId}.`
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function restoreConflictWarning(input: {
  path: string[];
  message: string;
  suggestion: string;
}): DiagnosticIssue {
  return createDiagnosticWarning(
    'PROJECT_DATA279',
    input.message,
    { path: input.path },
    input.suggestion
  );
}

function garbageCollectionBlocker(input: {
  trashItemId: string;
  assetId: string;
  message: string;
  suggestion: string;
}): ProjectDataError {
  return new ProjectDataError('PROJECT_DATA280', input.message, {
    issues: [
      createDiagnosticError(
        'PROJECT_DATA280',
        input.message,
        { path: ['trashItem', input.trashItemId, 'asset', input.assetId] },
        input.suggestion
      ),
    ],
    suggestion: input.suggestion,
  });
}
