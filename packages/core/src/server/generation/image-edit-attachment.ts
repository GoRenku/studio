import type {
  GenerationPurpose,
  GenerationSpec,
  GenerationTarget,
} from '../../client/generation.js';
import { readAssetRelationship } from '../database/access/asset-relationships/index.js';
import { readAssetFileRecord } from '../database/access/asset-files.js';
import { readAssetRecord } from '../database/access/assets.js';
import { readLookbookImageRecordByAsset } from '../database/access/lookbook-images.js';
import { readLookbookSheetRecordByAsset } from '../database/access/lookbook-sheets.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';

export function validateImageEditAttachment(input: {
  session: DatabaseSession;
  spec: GenerationSpec;
  destinationPurpose: GenerationPurpose;
  destinationTarget: GenerationTarget;
  destinationRelationshipRole: string;
}): void {
  if (input.spec.purpose !== 'image.edit' || input.spec.target.kind !== 'asset') {
    throw mismatch();
  }
  const source = input.spec.references.find((selection) =>
    selection.placement.kind === 'slot' &&
    selection.placement.sectionId === 'source' &&
    selection.placement.slotId === 'source-image'
  );
  if (!source || source.reference.kind !== 'asset-file' ||
      source.reference.assetId !== input.spec.target.id) {
    throw mismatch();
  }
  const asset = readAssetRecord(input.session, source.reference.assetId);
  const file = readAssetFileRecord(input.session, {
    assetId: source.reference.assetId,
    assetFileId: source.reference.assetFileId,
  });
  if (!asset || asset.discardedAt || asset.mediaKind !== 'image' ||
      !file || file.mediaKind !== 'image') {
    throw mismatch();
  }

  if (input.destinationTarget.kind === 'castMember') {
    assertRelationship(input, {
      kind: 'castMember',
      castMemberId: input.destinationTarget.id,
    }, asset.id);
    return;
  }
  if (input.destinationTarget.kind === 'location') {
    assertRelationship(input, {
      kind: 'location',
      locationId: input.destinationTarget.id,
    }, asset.id);
    return;
  }
  if (input.destinationTarget.kind === 'lookbook') {
    const membership = input.destinationPurpose === 'lookbook.image'
      ? readLookbookImageRecordByAsset(input.session, {
          lookbookId: input.destinationTarget.id,
          assetId: asset.id,
        })
      : input.destinationPurpose === 'lookbook.video-sheet' ||
          input.destinationPurpose === 'lookbook.storyboard-sheet'
        ? readLookbookSheetRecordByAsset(input.session, {
            lookbookId: input.destinationTarget.id,
            assetId: asset.id,
          })
        : null;
    if (!membership) {
      throw mismatch();
    }
    return;
  }
  throw mismatch();
}

function assertRelationship(
  input: Parameters<typeof validateImageEditAttachment>[0],
  target:
    | { kind: 'castMember'; castMemberId: string }
    | { kind: 'location'; locationId: string },
  assetId: string,
): void {
  const relationship = readAssetRelationship(input.session, { target, assetId });
  if (!relationship || relationship.role !== input.destinationRelationshipRole) {
    throw mismatch();
  }
}

function mismatch(): ProjectDataError {
  return new ProjectDataError(
    'CORE_GENERATION_ATTACHMENT_IMAGE_EDIT_SOURCE_MISMATCH',
    'The image edit source must be the exact active image owned by the requested destination.'
  );
}
