import type { MediaGenerationPurposeBuilder } from '../purpose-registry.js';
import { suggestLookbookMedia } from '../reference-suggestions.js';
import { readMediaGenerationLookbooks } from '../visual-language-context.js';

export const buildProjectPurposeContext: MediaGenerationPurposeBuilder = (input) => {
  const visualLanguage = input.purpose === 'project.cover'
    ? readMediaGenerationLookbooks({ session: input.session, projectFolder: input.projectFolder, kinds: ['production'] })
    : [];
  return {
    targetContext: { kind: 'project' },
    visualLanguage,
    suggestedReferences: input.purpose === 'project.cover'
      ? suggestLookbookMedia({ lookbooks: visualLanguage, role: 'appearance', projectFolder: input.projectFolder, warnings: input.warnings })
      : [],
    resourceKeys: [],
  };
};
