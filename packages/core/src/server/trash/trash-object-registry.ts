import { createDiagnosticWarning } from '@gorenku/studio-diagnostics';
import { and, eq, isNull } from 'drizzle-orm';
import type { TrashItemKind } from '../../client/index.js';
import {
  assetFiles,
  castVoices,
  inspirationFolders,
  lookbookImages,
  lookbookSheets,
  shotPlanDialogueAudioTakes,
} from '../schema/index.js';
import {
  studioAssetFileOwnerSurfaceResourceKeys,
  studioCastMemberSurfaceResourceKey,
  studioVisualLanguageInspirationFolderResourceKey,
  studioVisualLanguageInspirationResourceKey,
  studioVisualLanguageLookbookResourceKey,
  studioVisualLanguageLookbooksResourceKey,
  studioSceneShotPlansResourceKey,
  projectCoverCandidateResourceKeys,
  studioShotPlanDialogueAudioResourceKey,
} from '../studio-coordination/resource-keys.js';
import { shotPlanVideoAssetFileResourceKeys } from '../shot-plan-video-generations/source-provenance.js';
import { shotPlanAssetFileResourceKeys } from '../asset-files/resource-keys.js';
import { ProjectDataError } from '../project-data-error.js';
import type {
  TrashObjectDefinition,
  TrashObjectDiscardContext,
  TrashObjectResourceKeyContext,
  TrashObjectRestoreContext,
} from './trash-object-definition.js';
import {
  collectAssetFile,
  markAssetFileDiscarded,
  requireAssetFileSnapshot,
  restoreAssetFile,
} from './asset-file-lifecycle.js';
import { shotPlanTrashDefinition } from '../shot-plans/trash.js';
import { shotTrashDefinition } from '../shot-plans/shot-trash.js';
import { requireAssetFileOwner } from '../asset-files/ownership.js';
import { clearSelectedAssetFileRecordForAssetFile } from '../database/access/selected-asset-files.js';
import { readShotRecord } from '../database/access/shot-plans/shot-records.js';
import { requireShotPlanRecord } from '../database/access/shot-plans/plan-records.js';
import { readAssetFileRecordIncludingDiscarded } from '../database/access/asset-files.js';
import {
  clearCastVoiceDefaultRecord,
  readCastVoiceDefaultRecord,
  selectCastVoiceDefaultRecord,
} from '../database/access/cast-voices.js';

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
    const state = { discardedAt: input.now, discardOperationId: input.operationId, restoredAt: null };
    input.session.db.update(inspirationFolders).set(state).where(eq(inspirationFolders.id, input.itemId)).run();
    input.session.db.update(assetFiles).set(state).where(and(eq(assetFiles.ownerKey, `inspirationFolder:${encodeURIComponent(input.itemId)}`), isNull(assetFiles.discardedAt))).run();
  },
  applyRestore(input) {
    const state = { discardedAt: null, discardOperationId: null, restoredAt: input.now };
    input.session.db.update(inspirationFolders).set(state).where(eq(inspirationFolders.id, input.trashItem.itemId)).run();
    input.session.db.update(assetFiles).set(state).where(and(eq(assetFiles.ownerKey, `inspirationFolder:${encodeURIComponent(input.trashItem.itemId)}`), eq(assetFiles.discardOperationId, input.trashItem.operationId))).run();
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
    const owner = requireAssetFileOwner(input.session, image.assetFileId);
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
          assetFileId: image.assetFileId,
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
    const snapshot = requireAssetFileSnapshot(input.snapshot, input.trashItem.id);
    return collectAssetFile(input, snapshot.assetFileId);
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
    const owner = requireAssetFileOwner(input.session, sheet.assetFileId);
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
          assetFileId: sheet.assetFileId,
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
    const snapshot = requireAssetFileSnapshot(input.snapshot, input.trashItem.id);
    return collectAssetFile(input, snapshot.assetFileId);
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

const assetFileDefinition: TrashObjectDefinition = {
  itemKind: 'assetFile',
  readTrashItems(input) {
    const assetFile = input.session.db
      .select()
      .from(assetFiles)
      .where(and(eq(assetFiles.id, input.itemId), isNull(assetFiles.discardedAt)))
      .get();
    if (!assetFile) {
      return [];
    }
    return [
      {
        itemKind: 'assetFile',
        itemId: assetFile.id,
        title: assetFile.title ?? '',
        originalProjectRelativePath: assetFile.projectRelativePath,
        ownerKind: requireAssetFileOwner(input.session, assetFile.id).kind,
        ownerId: assetFile.ownerKey.startsWith('inspirationFolder:') ? decodeURIComponent(assetFile.ownerKey.slice('inspirationFolder:'.length)) : undefined,
        restoreSnapshot: {
          assetFileId: assetFile.id,
        },
      },
    ];
  },
  applyDiscard(input) {
    markAssetFileDiscarded(input);
    clearSelectedAssetFileRecordForAssetFile(input.session, input.itemId);
  },
  applyRestore(input) {
    restoreAssetFile(input);
  },
  collectFiles(input) {
    return collectAssetFile(input, input.trashItem.itemId);
  },
  resourceKeys(input) {
    const owner = requireAssetFileOwner(input.session, input.itemId);
    const assetFile = readAssetFileRecordIncludingDiscarded(input.session, input.itemId);
    if (owner.kind === 'project' && assetFile?.type === 'project_cover') {
      return projectCoverCandidateResourceKeys();
    }
    const videoGenerationKeys = shotPlanVideoAssetFileResourceKeys(
      input.session,
      input.itemId,
    );
    if (owner.kind !== 'shot') {
      return [
        ...studioAssetFileOwnerSurfaceResourceKeys(owner),
        ...videoGenerationKeys,
        ...shotPlanAssetFileResourceKeys(input.session, input.itemId),
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
    return [{ type: 'asset.restored', assetFileId: input.itemId }];
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
    const defaultVoice = readCastVoiceDefaultRecord(
      input.session,
      voice.castMemberId
    );
    return [
      {
        itemKind: 'castVoice',
        itemId: voice.id,
        ownerKind: 'castMember',
        ownerId: voice.castMemberId,
        title: voice.name,
        restoreSnapshot: {
          castMemberId: voice.castMemberId,
          sampleAssetFileId: voice.sampleAssetFileId,
          wasDefault: defaultVoice?.castVoiceId === voice.id,
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
    clearCastVoiceDefaultRecord(input.session, {
      castMemberId: voice.castMemberId,
      castVoiceId: voice.id,
    });
    markAssetFileDiscarded({
      ...input,
      itemId: voice.sampleAssetFileId,
    });
  },
  applyRestore(input) {
    const snapshot = requireCastVoiceSnapshot(input.snapshot, input.trashItem.id);
    input.session.db
      .update(castVoices)
      .set({ discardedAt: null, discardOperationId: null, restoredAt: input.now })
      .where(eq(castVoices.id, input.trashItem.itemId))
      .run();
    restoreAssetFile({
      ...input,
      trashItem: { ...input.trashItem, itemId: snapshot.sampleAssetFileId },
    });
    if (!snapshot.wasDefault) {
      return [];
    }
    const currentDefault = readCastVoiceDefaultRecord(
      input.session,
      snapshot.castMemberId
    );
    if (!currentDefault) {
      selectCastVoiceDefaultRecord(input.session, {
        castMemberId: snapshot.castMemberId,
        castVoiceId: input.trashItem.itemId,
        now: input.now,
      });
      return [];
    }
    if (currentDefault.castVoiceId === input.trashItem.itemId) {
      return [];
    }
    return [
      createDiagnosticWarning(
        'CORE_TRASH_CAST_VOICE_DEFAULT_CONFLICT',
        `Restored Cast Voice ${input.trashItem.itemId}, but kept the newer default Cast Voice ${currentDefault.castVoiceId}.`,
        { path: ['castMember', snapshot.castMemberId, 'defaultCastVoice'] },
        'Select the restored Cast Voice again if it should replace the current default.'
      ),
    ];
  },
  collectFiles(input) {
    const snapshot = requireCastVoiceSnapshot(input.snapshot, input.trashItem.id);
    return collectAssetFile(input, snapshot.sampleAssetFileId);
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

const shotPlanDialogueAudioTakeDefinition: TrashObjectDefinition = {
  itemKind: 'shotPlanDialogueAudioTake',
  readTrashItems(input) {
    const take = input.session.db
      .select()
      .from(shotPlanDialogueAudioTakes)
      .where(and(
        eq(shotPlanDialogueAudioTakes.id, input.itemId),
        isNull(shotPlanDialogueAudioTakes.discardedAt),
      ))
      .get();
    if (!take) {
      return [];
    }
    return [
      {
        itemKind: 'shotPlanDialogueAudioTake',
        itemId: take.id,
        ownerKind: 'shotPlan',
        ownerId: take.shotPlanId,
        title: take.id,
        restoreSnapshot: {
          shotPlanId: take.shotPlanId,
          assetFileId: take.assetFileId,
        },
      },
    ];
  },
  applyDiscard(input) {
    const take = input.session.db
      .select()
      .from(shotPlanDialogueAudioTakes)
      .where(eq(shotPlanDialogueAudioTakes.id, input.itemId))
      .get();
    if (!take) {
      return;
    }
    input.session.db
      .update(shotPlanDialogueAudioTakes)
      .set({
        selectedAt: null,
        discardedAt: input.now,
        discardOperationId: input.operationId,
        restoredAt: null,
        updatedAt: input.now,
      })
      .where(eq(shotPlanDialogueAudioTakes.id, input.itemId))
      .run();
    markAssetFileDiscarded({ ...input, itemId: take.assetFileId });
  },
  applyRestore(input) {
    const snapshot = requireDialogueTakeSnapshot(input.snapshot, input.trashItem.id);
    input.session.db
      .update(shotPlanDialogueAudioTakes)
      .set({
        selectedAt: null,
        discardedAt: null,
        discardOperationId: null,
        restoredAt: input.now,
        updatedAt: input.now,
      })
      .where(eq(shotPlanDialogueAudioTakes.id, input.trashItem.itemId))
      .run();
    restoreAssetFile({
      ...input,
      trashItem: { ...input.trashItem, itemId: snapshot.assetFileId },
    });
    return [];
  },
  collectFiles(input) {
    const snapshot = requireDialogueTakeSnapshot(input.snapshot, input.trashItem.id);
    return collectAssetFile(input, snapshot.assetFileId);
  },
  resourceKeys(input) {
    return [
      'trash:list',
      studioShotPlanDialogueAudioResourceKey(
        requireTrashOwnerId(input, 'shotPlanDialogueAudioTake')
      ),
    ];
  },
  restoredChanges(input) {
    return [{ type: 'shotPlanDialogueAudioTake.restored', takeId: input.itemId }];
  },
};

const trashObjectDefinitions: Partial<Record<TrashItemKind, TrashObjectDefinition>> = {
  assetFile: assetFileDefinition,
  castVoice: castVoiceDefinition,
  shotPlanDialogueAudioTake: shotPlanDialogueAudioTakeDefinition,
  shot: shotTrashDefinition,
  shotPlan: shotPlanTrashDefinition,


  inspirationFolder: inspirationFolderDefinition,
  lookbookImage: lookbookImageDefinition,
  lookbookSheet: lookbookSheetDefinition,
};

function markLookbookImageDiscarded(input: TrashObjectDiscardContext): void {
  const image = input.session.db
    .select({ assetFileId: lookbookImages.assetFileId })
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
    markAssetFileDiscarded({ ...input, itemId: image.assetFileId });
    clearSelectedAssetFileRecordForAssetFile(input.session, image.assetFileId);
  }
}

function restoreLookbookImage(input: TrashObjectRestoreContext): void {
  const snapshot = requireAssetFileSnapshot(input.snapshot, input.trashItem.id);
  input.session.db
    .update(lookbookImages)
    .set({ discardedAt: null, discardOperationId: null, restoredAt: input.now })
    .where(eq(lookbookImages.id, input.trashItem.itemId))
    .run();
  restoreAssetFile({
    ...input,
    trashItem: { ...input.trashItem, itemId: snapshot.assetFileId },
  });
}

function markLookbookSheetDiscarded(input: TrashObjectDiscardContext): void {
  const sheet = input.session.db
    .select({ assetFileId: lookbookSheets.assetFileId })
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
    markAssetFileDiscarded({ ...input, itemId: sheet.assetFileId });
  }
}

function restoreLookbookSheet(input: TrashObjectRestoreContext): void {
  const snapshot = requireAssetFileSnapshot(input.snapshot, input.trashItem.id);
  input.session.db
    .update(lookbookSheets)
    .set({ discardedAt: null, discardOperationId: null, restoredAt: input.now })
    .where(eq(lookbookSheets.id, input.trashItem.itemId))
    .run();
  restoreAssetFile({
    ...input,
    trashItem: { ...input.trashItem, itemId: snapshot.assetFileId },
  });
}

function requireCastVoiceSnapshot(
  snapshot: Record<string, unknown>,
  trashItemId: string
): { castMemberId: string; sampleAssetFileId: string; wasDefault: boolean } {
  if (
    typeof snapshot.castMemberId === 'string' &&
    typeof snapshot.sampleAssetFileId === 'string' &&
    typeof snapshot.wasDefault === 'boolean'
  ) {
    return {
      castMemberId: snapshot.castMemberId,
      sampleAssetFileId: snapshot.sampleAssetFileId,
      wasDefault: snapshot.wasDefault,
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
): { shotPlanId: string; assetFileId: string } {
  if (
    typeof snapshot.shotPlanId === 'string' &&
    typeof snapshot.assetFileId === 'string'
  ) {
    return {
      shotPlanId: snapshot.shotPlanId,
      assetFileId: snapshot.assetFileId,
    };
  }
  throw new ProjectDataError(
    'PROJECT_DATA270',
    `Shot Plan Dialogue Audio take trash item snapshot is invalid: ${trashItemId}.`
  );
}
