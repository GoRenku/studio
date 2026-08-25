import { readLookbookRecordById } from '../../database/access/lookbook.js';
import { readProjectRecord } from '../../database/access/project.js';
import { ProjectDataError } from '../../project-data-error.js';
import { readLookbookResourceFromSession } from '../../resources/project-lookbooks.js';
import type { MediaGenerationPurposeBuilder } from '../purpose-registry.js';
import { createReferenceSuggestion } from '../reference-suggestions.js';

export const buildLookbookPurposeContext: MediaGenerationPurposeBuilder = (input) => {
  if (input.target.kind !== 'lookbook') {
    throw invalidTarget();
  }
  const row = readLookbookRecordById(input.session, input.target.id);
  const project = readProjectRecord(input.session);
  if (!row || !project) {
    throw new ProjectDataError('CORE_MEDIA_GENERATION_CONTEXT_TARGET_NOT_FOUND', `Media generation target Lookbook was not found: ${input.target.id}.`);
  }
  const requiredKind = input.purpose === 'lookbook.video-sheet'
    ? 'production'
    : input.purpose === 'lookbook.storyboard-sheet'
      ? 'storyboard'
      : null;
  if (requiredKind && row.kind !== requiredKind) {
    throw new ProjectDataError('CORE_GENERATION_TARGET_INVALID', `${input.purpose} requires the ${requiredKind} Lookbook.`);
  }
  const resource = readLookbookResourceFromSession(input.session, input.projectFolder, project, row);
  const visualLanguage = [{
    kind: row.kind,
    lookbook: resource.lookbook,
    selectedImageId: resource.selectedImageId,
    images: resource.images,
    sheets: resource.sheets,
  }];
  return {
    targetContext: {
      kind: 'lookbook',
      lookbook: resource.lookbook,
      selectedImageId: resource.selectedImageId,
      images: resource.images,
      sheets: resource.sheets,
      sourceInspirationFolders: resource.sourceInspirationFolders,
    },
    visualLanguage,
    suggestedReferences: [
      createReferenceSuggestion({
        id: 'lookbook-images',
        role: 'appearance',
        assets: resource.images.map((image) => image.asset),
        selectedAssetIds: resource.selectedImageId ? [resource.selectedImageId] : [],
        projectFolder: input.projectFolder,
        warnings: input.warnings,
      }),
      createReferenceSuggestion({
        id: 'lookbook-sheets',
        role: 'continuity',
        assets: resource.sheets.map((sheet) => sheet.asset),
        projectFolder: input.projectFolder,
        warnings: input.warnings,
      }),
    ],
    resourceKeys: resource.resourceKeys,
  };
};

function invalidTarget(): ProjectDataError {
  return new ProjectDataError('CORE_GENERATION_TARGET_INVALID', 'Lookbook media generation requires a Lookbook target.');
}
