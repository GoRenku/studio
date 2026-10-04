import type { AssetFile } from '../../client/asset-files.js';
import type { MediaGenerationProvenance } from '../../client/media-generation-review.js';
import { parseAssetFileOwnerKey } from '../asset-files/owner-keys.js';
import { readOwnedAssetFile } from '../asset-files/projection.js';
import { readAssetFileRecordIncludingDiscarded } from '../database/access/asset-files.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { resolveProjectRelativePath } from '../files/project-relative-paths.js';
import { mediaGenerationReferenceProjectPaths } from '../media-generation-review/local-media.js';
import { statProjectFileSync } from '../project-asset-files/file-operations.js';
import { ProjectDataError } from '../project-data-error.js';


export function readVideoEditSource(input: {
  session: DatabaseSession;
  projectFolder: string;
  assetFileId: string;
  generationProvenance: MediaGenerationProvenance;
}): AssetFile {
  const record = readAssetFileRecordIncludingDiscarded(input.session, input.assetFileId);
  const assetFile = record
    ? readOwnedAssetFile(input.session, {
        owner: parseAssetFileOwnerKey(record.ownerKey),
        assetFileId: input.assetFileId,
      })
    : null;
  if (!assetFile || assetFile.mediaKind !== 'video') {
    throw sourceInvalid();
  }
  if (input.generationProvenance.mediaKind !== 'video') {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_PROVENANCE_INVALID',
      'video.edit provenance must describe video media.',
    );
  }
  const provenancePaths = mediaGenerationReferenceProjectPaths(
    input.generationProvenance.request,
  );
  const matchedPaths = provenancePaths.filter((projectRelativePath) =>
    assetFile.projectRelativePath === projectRelativePath,
  );
  if (matchedPaths.length === 0) {
    throw new ProjectDataError(
      'CORE_VIDEO_EDIT_SOURCE_REFERENCE_MISSING',
      'video.edit provenance must reference one current file from the source Asset.',
    );
  }
  const file = assetFile;
  statProjectFileSync(
    resolveProjectRelativePath(input.projectFolder, file.projectRelativePath),
    {
      code: 'CORE_VIDEO_EDIT_SOURCE_INVALID',
      message: 'video.edit source AssetFile is not available in the Project folder.',
    },
  );
  return assetFile;
}

function sourceInvalid(): ProjectDataError {
  return new ProjectDataError(
    'CORE_VIDEO_EDIT_SOURCE_INVALID',
    'video.edit requires an active video Asset with a current video file.',
  );
}
