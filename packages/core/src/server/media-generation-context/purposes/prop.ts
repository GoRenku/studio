import { readPropRecord } from '../../database/access/props.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { MediaGenerationPurposeBuilder } from '../purpose-registry.js';
import { createReferenceSuggestion, suggestLookbookMedia } from '../reference-suggestions.js';
import { projectPropContext, scenesForSubject } from '../scene-context.js';
import { readMediaGenerationLookbooks } from '../visual-language-context.js';

export const buildPropPurposeContext: MediaGenerationPurposeBuilder = (input) => {
  if (input.target.kind !== 'prop') {
    throw invalidTarget();
  }
  const record = readPropRecord(input.session, input.target.id);
  if (!record) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_CONTEXT_TARGET_NOT_FOUND',
      `Media generation target Prop was not found: ${input.target.id}.`,
    );
  }
  const context = projectPropContext(input.session, record);
  const visualLanguage = readMediaGenerationLookbooks({
    session: input.session,
    projectFolder: input.projectFolder,
    kinds: input.purpose === 'prop.sheet' ? ['production', 'storyboard'] : ['production'],
  });
  return {
    targetContext: {
      kind: 'prop',
      ...context,
      scenes: scenesForSubject(input.screenplay, { type: 'prop', id: record.id }),
    },
    visualLanguage,
    suggestedReferences: [
      ...suggestLookbookMedia({
        lookbooks: visualLanguage,
        role: 'appearance',
        projectFolder: input.projectFolder,
        warnings: input.warnings,
      }),
      createReferenceSuggestion({
        id: 'prop-continuity',
        role: 'continuity',
        subject: { kind: 'prop', id: record.id },
        assets: context.assets.filter((asset) => asset.type === 'prop_sheet'),
        projectFolder: input.projectFolder,
        warnings: input.warnings,
      }),
    ],
    resourceKeys: [],
  };
};

function invalidTarget(): ProjectDataError {
  return new ProjectDataError('CORE_GENERATION_TARGET_INVALID', 'Prop media generation requires a Prop target.');
}
