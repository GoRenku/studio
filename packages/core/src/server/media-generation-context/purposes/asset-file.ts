import { readAssetFileRecordIncludingDiscarded } from '../../database/access/asset-files.js';
import { parseAssetFileOwnerKey } from '../../asset-files/owner-keys.js';
import { readOwnedAssetFile } from '../../asset-files/projection.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { MediaGenerationPurposeBuilder } from '../purpose-registry.js';
import { createReferenceSuggestion } from '../reference-suggestions.js';

export const buildAssetFilePurposeContext: MediaGenerationPurposeBuilder = (input) => {
  if (input.target.kind !== 'assetFile') {
    throw invalidTarget();
  }
  const record = readAssetFileRecordIncludingDiscarded(input.session, input.target.assetFileId);
  const assetFile = record
    ? readOwnedAssetFile(input.session, { owner: parseAssetFileOwnerKey(record.ownerKey), assetFileId: input.target.assetFileId })
    : null;
  if (!assetFile) {
    throw new ProjectDataError('CORE_MEDIA_GENERATION_CONTEXT_TARGET_NOT_FOUND', `Media generation target Asset was not found: ${input.target.assetFileId}.`);
  }
  const sourceMediaKind = input.purpose === 'video.edit' ? 'video' : 'image';
  if (assetFile.mediaKind !== sourceMediaKind) {
    throw new ProjectDataError(
      input.purpose === 'video.edit'
        ? 'CORE_VIDEO_EDIT_SOURCE_INVALID'
        : 'CORE_IMAGE_EDIT_SOURCE_INVALID',
      `${input.purpose} requires an active ${sourceMediaKind} Asset with a current ${sourceMediaKind} file.`,
    );
  }
  return {
    targetContext: { kind: 'assetFile', assetFileId: input.assetFiles.add(assetFile) },
    visualLanguage: [],
    suggestedReferences: [createReferenceSuggestion({
      id: input.purpose === 'video.edit' ? 'source-video' : 'source-image',
      role: input.purpose === 'video.edit' ? 'source-video' : 'source-image',
      assetFiles: [assetFile],
      fileIds: [assetFile.id],
      projectFolder: input.projectFolder,
      collection: input.assetFiles,
      warnings: input.warnings,
    })],
    resourceKeys: [],
  };
};

function invalidTarget(): ProjectDataError {
  return new ProjectDataError('CORE_GENERATION_TARGET_INVALID', 'Asset media editing requires an Asset target.');
}
