import type {
  ImageRevisionTarget,
  MediaGenerationRun,
} from '../../client/index.js';
import {
  readAssetFileGenerationRecord,
} from '../database/access/asset-file-generations.js';
import {
  readAssetFileRecordByIdIncludingDiscarded,
  type AssetFileRecord,
} from '../database/access/asset-files.js';
import {
  readAssetRecord,
  type AssetRecord,
} from '../database/access/assets.js';
import { readAssetRelationship } from '../database/access/asset-relationships/index.js';
import { requireMediaGenerationRun } from '../database/access/media-generation.js';
import { requireLookbookImageRecord } from '../database/access/lookbook-images.js';
import { requireLookbookSheetRecord } from '../database/access/lookbook-sheets.js';
import {
  requireShotVideoTakeInput,
  requireShotVideoTakeInputRecord,
} from '../database/access/shot-video-takes.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';

export interface ResolvedImageRevisionSource {
  target: ImageRevisionTarget;
  asset: AssetRecord;
  file: AssetFileRecord;
  generationRun: MediaGenerationRun | null;
}

export function resolveImageRevisionSource(
  session: DatabaseSession,
  target: ImageRevisionTarget,
): ResolvedImageRevisionSource {
  const asset = readAssetRecord(session, target.assetId);
  const file = readAssetFileRecordByIdIncludingDiscarded(
    session,
    target.assetFileId,
  );
  if (
    !asset ||
    asset.discardedAt ||
    !file ||
    file.discardedAt ||
    file.assetId !== asset.id
  ) {
    throw new ProjectDataError(
      'CORE_IMAGE_REVISION_OWNER_MISMATCH',
      'The selected image does not belong to the requested active Asset.',
    );
  }
  if (file.mediaKind !== 'image') {
    throw new ProjectDataError(
      'CORE_IMAGE_REVISION_SOURCE_FILE_NOT_IMAGE',
      `Image Revision requires an image AssetFile: ${file.id}.`,
    );
  }
  assertTargetOwnership(session, target);
  const provenance = readAssetFileGenerationRecord(session, file.id);
  return {
    target,
    asset,
    file,
    generationRun: provenance
      ? requireMediaGenerationRun(session, provenance.mediaGenerationRunId)
      : null,
  };
}

function assertTargetOwnership(
  session: DatabaseSession,
  target: ImageRevisionTarget,
): void {
  switch (target.kind) {
    case 'castCharacterSheet': {
      const relationship = readAssetRelationship(session, {
        target: { kind: 'castMember', castMemberId: target.castMemberId },
        assetId: target.assetId,
      });
      if (!relationship || relationship.role !== 'character_sheet') {
        ownerMismatch(target.kind);
      }
      return;
    }
    case 'locationEnvironmentSheet': {
      const relationship = readAssetRelationship(session, {
        target: { kind: 'location', locationId: target.locationId },
        assetId: target.assetId,
      });
      if (!relationship || relationship.role !== 'environment_sheet') {
        ownerMismatch(target.kind);
      }
      return;
    }
    case 'lookbookImage': {
      const image = requireLookbookImageRecord(session, target.imageId);
      if (
        image.lookbookId !== target.lookbookId ||
        image.assetId !== target.assetId
      ) {
        ownerMismatch(target.kind);
      }
      return;
    }
    case 'lookbookSheet': {
      const sheet = requireLookbookSheetRecord(session, target.sheetId);
      if (
        sheet.lookbookId !== target.lookbookId ||
        sheet.assetId !== target.assetId
      ) {
        ownerMismatch(target.kind);
      }
      return;
    }
    case 'shotVideoTakeInput': {
      const inputRecord = requireShotVideoTakeInputRecord(session, target.inputId);
      const input = requireShotVideoTakeInput(session, target.inputId);
      if (
        inputRecord.sceneId !== target.sceneId ||
        input.takeId !== target.takeId ||
        input.assetId !== target.assetId ||
        input.assetFileId !== target.assetFileId
      ) {
        ownerMismatch(target.kind);
      }
      if (!input.selected) {
        throw new ProjectDataError(
          'CORE_IMAGE_REVISION_SOURCE_INPUT_NOT_SELECTED',
          'Only the selected take-owned image input can be revised.',
        );
      }
      if (
        ![
          'first-frame',
          'last-frame',
          'reference-image',
          'video-prompt-sheet',
        ].includes(input.kind)
      ) {
        throw new ProjectDataError(
          'CORE_IMAGE_REVISION_TARGET_UNSUPPORTED',
          `Shot Video Take input kind is not supported by Image Revision: ${input.kind}.`,
        );
      }
      return;
    }
    default:
      assertNever(target);
  }
}

function ownerMismatch(kind: ImageRevisionTarget['kind']): never {
  throw new ProjectDataError(
    'CORE_IMAGE_REVISION_OWNER_MISMATCH',
    `The selected Asset does not belong to the requested ${kind} owner.`,
  );
}

function assertNever(value: never): never {
  throw new ProjectDataError(
    'CORE_IMAGE_REVISION_TARGET_UNSUPPORTED',
    `Unsupported Image Revision target: ${String(value)}.`,
  );
}
