import type { AssetFile } from '../../client/asset-files.js';
import type { MediaGenerationProvenance } from '../../client/media-generation-review.js';
import { readOwnedAssetFile } from '../asset-files/projection.js';
import { parseAssetFileOwnerKey } from '../asset-files/owner-keys.js';
import { readAssetFileRecordIncludingDiscarded } from '../database/access/asset-files.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { mediaGenerationReferenceProjectPaths } from '../media-generation-review/local-media.js';
import { ProjectDataError } from '../project-data-error.js';

export function readImageEditSource(input: {
  session: DatabaseSession;
  assetFileId: string;
  generationProvenance: MediaGenerationProvenance;
}): AssetFile {
  const record = readAssetFileRecordIncludingDiscarded(input.session, input.assetFileId);
  const source = record
    ? readOwnedAssetFile(input.session, {
        owner: parseAssetFileOwnerKey(record.ownerKey),
        assetFileId: input.assetFileId,
      })
    : null;
  if (!source || source.mediaKind !== 'image') {
    throw sourceInvalid();
  }
  const provenancePaths = new Set(
    mediaGenerationReferenceProjectPaths(input.generationProvenance.request),
  );
  if (!provenancePaths.has(source.projectRelativePath)) {
    throw new ProjectDataError(
      'CORE_IMAGE_EDIT_SOURCE_REFERENCE_MISSING',
      'image.edit provenance must reference a current file from the source Asset.',
    );
  }
  if (input.generationProvenance.mediaKind !== 'image') {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_PROVENANCE_INVALID',
      'image.edit provenance must describe image media.',
    );
  }
  return source;
}

function sourceInvalid(): ProjectDataError {
  return new ProjectDataError(
    'CORE_IMAGE_EDIT_SOURCE_INVALID',
    'image.edit requires an active image Asset with a current image file.',
  );
}
