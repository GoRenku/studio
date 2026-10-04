import { readLocationRecord } from '../../database/access/locations.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { MediaGenerationPurposeBuilder } from '../purpose-registry.js';
import { createReferenceSuggestion, suggestLookbookMedia } from '../reference-suggestions.js';
import { projectLocationContext, scenesForSubject } from '../scene-context.js';
import { readMediaGenerationLookbooks } from '../visual-language-context.js';

export const buildLocationPurposeContext: MediaGenerationPurposeBuilder = (input) => {
  if (input.target.kind !== 'location') {
    throw invalidTarget();
  }
  const record = readLocationRecord(input.session, input.target.id);
  if (!record) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_CONTEXT_TARGET_NOT_FOUND',
      `Media generation target Location was not found: ${input.target.id}.`,
    );
  }
  const context = projectLocationContext(input.session, record, input.assetFiles);
  const visualLanguage = readMediaGenerationLookbooks({
    session: input.session,
    assetFiles: input.assetFiles,
    projectFolder: input.projectFolder,
    kinds: input.purpose === 'location.sheet' ? ['production', 'storyboard'] : ['production'],
  });
  return {
    targetContext: {
      kind: 'location',
      ...context,
      scenes: scenesForSubject(input.screenplay, { type: 'location', id: record.id }),
    },
    visualLanguage,
    suggestedReferences: [
      ...suggestLookbookMedia({
        lookbooks: visualLanguage,
        role: 'appearance',
        projectFolder: input.projectFolder,
        collection: input.assetFiles,
        warnings: input.warnings,
      }),
      createReferenceSuggestion({
        id: 'location-continuity',
        role: 'continuity',
        subject: { kind: 'location', id: record.id },
        assetFiles: context.assetFileIds.map((id) => input.assetFiles.get(id)).filter((assetFile) => assetFile.type === 'location_sheet'),
        projectFolder: input.projectFolder,
        collection: input.assetFiles,
        warnings: input.warnings,
      }),
    ],
    resourceKeys: [],
  };
};

function invalidTarget(): ProjectDataError {
  return new ProjectDataError('CORE_GENERATION_TARGET_INVALID', 'Location media generation requires a Location target.');
}
