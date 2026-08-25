import type { Asset } from '../../client/assets.js';
import { readLookbookImageRecordByAsset } from '../database/access/lookbook-images.js';
import { readLookbookSheetRecordByAsset } from '../database/access/lookbook-sheets.js';
import { ProjectDataError } from '../project-data-error.js';
import { studioAssetOwnerSurfaceResourceKeys } from '../studio-coordination/resource-keys.js';
import type {
  ImageEditContinuation,
  ImageEditContinuationInput,
} from './continuation-registry.js';

export function resolveLookbookImageEditContinuation(
  input: ImageEditContinuationInput,
): ImageEditContinuation | null {
  const { source, session } = input;
  if (source.type !== 'lookbook_image' && source.type !== 'lookbook_sheet') {
    return null;
  }
  if (source.owner.kind !== 'lookbook') {
    throw ownerInvalid(source);
  }
  const record = source.type === 'lookbook_image'
    ? readLookbookImageRecordByAsset(session, {
        lookbookId: source.owner.id, assetId: source.id,
      })
    : readLookbookSheetRecordByAsset(session, {
        lookbookId: source.owner.id, assetId: source.id,
      });
  if (!record) {
    throw ownerInvalid(source);
  }
  return {
    owner: source.owner,
    assetType: source.type,
    destination: source.type === 'lookbook_image'
      ? {
          kind: 'visualLanguage.lookbookImage',
          lookbookId: source.owner.id,
          semanticName: semanticName(source),
        }
      : {
          kind: 'visualLanguage.lookbookSheet',
          lookbookId: source.owner.id,
          semanticName: semanticName(source),
        },
    fileRole: 'primary',
    resourceKeys: studioAssetOwnerSurfaceResourceKeys(source.owner),
  };
}

function semanticName(source: Asset): string {
  return source.referenceName?.trim() || source.title;
}

function ownerInvalid(source: Asset): ProjectDataError {
  return new ProjectDataError(
    'CORE_IMAGE_EDIT_OWNER_INVALID',
    `Asset ${source.id} has ownership that is invalid for ${source.type}.`,
  );
}
