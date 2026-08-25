import { readCastMemberRecord } from '../../database/access/cast-members.js';
import { ProjectDataError } from '../../project-data-error.js';
import { readCastMemberResourceFromSession } from '../../resources/continuity-subjects.js';
import type { MediaGenerationPurposeBuilder } from '../purpose-registry.js';
import { createReferenceSuggestion, suggestLookbookMedia } from '../reference-suggestions.js';
import { projectCastMemberContext, scenesForSubject } from '../scene-context.js';
import { readMediaGenerationLookbooks } from '../visual-language-context.js';

export const buildCastPurposeContext: MediaGenerationPurposeBuilder = (input) => {
  if (input.target.kind !== 'castMember') {
    throw invalidTarget();
  }
  const record = readCastMemberRecord(input.session, input.target.id);
  if (!record) {
    throw new ProjectDataError('CORE_MEDIA_GENERATION_CONTEXT_TARGET_NOT_FOUND', `Media generation target Cast Member was not found: ${input.target.id}.`);
  }
  const context = projectCastMemberContext(input.session, record);
  const voices = readCastMemberResourceFromSession(input.session, record.id).voices;
  const kinds = input.purpose === 'cast.character-sheet'
    ? ['production', 'storyboard'] as const
    : input.purpose === 'cast.profile'
      ? ['production'] as const
      : [];
  const visualLanguage = readMediaGenerationLookbooks({ session: input.session, projectFolder: input.projectFolder, kinds: [...kinds] });
  const continuity = createReferenceSuggestion({
    id: 'cast-continuity',
    role: 'continuity',
    subject: { kind: 'castMember', id: record.id },
    assets: context.assets.filter((asset) => asset.type === 'character_sheet'),
    projectFolder: input.projectFolder,
    warnings: input.warnings,
  });
  return {
    targetContext: {
      kind: 'castMember',
      ...context,
      scenes: scenesForSubject(input.screenplay, { type: 'castMember', id: record.id }),
      voices,
    },
    visualLanguage,
    suggestedReferences: input.purpose === 'cast.voice-sample'
      ? []
      : [...suggestLookbookMedia({ lookbooks: visualLanguage, role: 'appearance', projectFolder: input.projectFolder, warnings: input.warnings }), continuity],
    resourceKeys: [],
  };
};

function invalidTarget(): ProjectDataError {
  return new ProjectDataError('CORE_GENERATION_TARGET_INVALID', 'Cast media generation requires a Cast Member target.');
}
