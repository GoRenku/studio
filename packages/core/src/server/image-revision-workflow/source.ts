import type {
  GenerationRun,
  ImageRevisionTarget,
} from '../../client/index.js';
import { readAssetFileGenerationRecord } from '../database/access/asset-file-generations.js';
import {
  readAssetFileRecordByIdIncludingDiscarded,
  type AssetFileRecord,
} from '../database/access/asset-files.js';
import { readAssetRecord, type AssetRecord } from '../database/access/assets.js';
import { readAssetRelationship } from '../database/access/asset-relationships/index.js';
import { readGenerationRunRecord } from '../database/access/media-generation.js';
import { requireLookbookImageRecord } from '../database/access/lookbook-images.js';
import { requireLookbookSheetRecord } from '../database/access/lookbook-sheets.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';

export interface ResolvedImageRevisionSource {
  target: ImageRevisionTarget;
  asset: AssetRecord;
  file: AssetFileRecord;
  generationRun: GenerationRun | null;
  ownerRole?: string;
}

export function resolveImageRevisionSource(
  session: DatabaseSession,
  target: ImageRevisionTarget
): ResolvedImageRevisionSource {
  const asset = readAssetRecord(session, target.assetId);
  const file = readAssetFileRecordByIdIncludingDiscarded(session, target.assetFileId);
  if (
    !asset ||
    asset.discardedAt ||
    !file ||
    file.discardedAt ||
    file.assetId !== asset.id
  ) {
    throw ownerMismatch();
  }
  if (file.mediaKind !== 'image') {
    throw new ProjectDataError(
      'CORE_IMAGE_REVISION_SOURCE_FILE_NOT_IMAGE',
      `Image Revision requires an image AssetFile: ${file.id}.`
    );
  }
  assertOwnership(session, target);
  const ownerRole = readOwnerRole(session, target);
  const provenance = readAssetFileGenerationRecord(session, file.id);
  return {
    target,
    asset,
    file,
    generationRun: provenance
      ? readGenerationRunRecord(session, provenance.mediaGenerationRunId)
      : null,
    ...(ownerRole ? { ownerRole } : {}),
  };
}

function readOwnerRole(
  session: DatabaseSession,
  target: ImageRevisionTarget
): string | null {
  const owner = target.kind === 'castCharacterSheet'
    ? { kind: 'castMember' as const, castMemberId: target.castMemberId }
    : target.kind === 'locationEnvironmentSheet'
      ? { kind: 'location' as const, locationId: target.locationId }
      : target.kind === 'lookbookImage' || target.kind === 'lookbookSheet'
        ? { kind: 'project' as const }
        : null;
  if (!owner) {
    return null;
  }
  return readAssetRelationship(session, {
    target: owner,
    assetId: target.assetId,
  })?.role ?? null;
}

function assertOwnership(session: DatabaseSession, target: ImageRevisionTarget): void {
  if (target.kind === 'castCharacterSheet') {
    const relationship = readAssetRelationship(session, {
      target: { kind: 'castMember', castMemberId: target.castMemberId },
      assetId: target.assetId,
    });
    if (!relationship || !relationship.role.includes('character')) {
      throw ownerMismatch();
    }
    return;
  }
  if (target.kind === 'locationEnvironmentSheet') {
    const relationship = readAssetRelationship(session, {
      target: { kind: 'location', locationId: target.locationId },
      assetId: target.assetId,
    });
    if (!relationship || !relationship.role.includes('sheet')) {
      throw ownerMismatch();
    }
    return;
  }
  if (target.kind === 'lookbookImage') {
    const image = requireLookbookImageRecord(session, target.imageId);
    if (image.lookbookId !== target.lookbookId || image.assetId !== target.assetId) {
      throw ownerMismatch();
    }
    return;
  }
  if (target.kind === 'lookbookSheet') {
    const sheet = requireLookbookSheetRecord(session, target.sheetId);
    if (sheet.lookbookId !== target.lookbookId || sheet.assetId !== target.assetId) {
      throw ownerMismatch();
    }
    return;
  }
}

function ownerMismatch(): ProjectDataError {
  return new ProjectDataError(
    'CORE_IMAGE_REVISION_OWNER_MISMATCH',
    'The selected image does not belong to the requested active owner.'
  );
}
