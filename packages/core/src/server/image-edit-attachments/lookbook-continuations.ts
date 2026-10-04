import type { AssetFile } from '../../client/asset-files.js';
import { readLookbookImageRecordByAssetFile } from '../database/access/lookbook-images.js';
import { readLookbookSheetRecordByAssetFile } from '../database/access/lookbook-sheets.js';
import { ProjectDataError } from '../project-data-error.js';
import { studioAssetFileOwnerSurfaceResourceKeys } from '../studio-coordination/resource-keys.js';
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
    ? readLookbookImageRecordByAssetFile(session, {
        lookbookId: source.owner.id, assetFileId: source.id,
      })
    : readLookbookSheetRecordByAssetFile(session, {
        lookbookId: source.owner.id, assetFileId: source.id,
      });
  if (!record) {
    throw ownerInvalid(source);
  }
  return {
    owner: source.owner,
    assetFileType: source.type,
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
    resourceKeys: studioAssetFileOwnerSurfaceResourceKeys(source.owner),
  };
}

function semanticName(source: AssetFile): string {
  return source.referenceName?.trim() || source.title || source.id;
}

function ownerInvalid(source: AssetFile): ProjectDataError {
  return new ProjectDataError(
    'CORE_IMAGE_EDIT_OWNER_INVALID',
    `Asset ${source.id} has ownership that is invalid for ${source.type}.`,
  );
}
