import { defineGenerationPurpose } from '../purpose-factory.js';
import { buildReferenceGuide, selectedLookbookSheetFileIds } from '../purpose-guide.js';
export const sceneStoryboardSheetPurpose = defineGenerationPurpose({
  purpose: 'scene.storyboard-sheet', targetKind: 'scene', outputMediaKind: 'image', modelUse: 'any',
  settings: { fixed: [{ kind: 'aspect-ratio', value: '4:3' }, { kind: 'quality', value: 'high' }], recommended: [], recommendedModel: { provider: 'fal-ai', model: 'openai/gpt-image-2' } },
  async buildReferenceGuide(context) {
    const guide = buildReferenceGuide({ context, slots: [{ sectionId: 'visual-language', sectionLabel: 'Visual Language', slotId: 'storyboard-lookbook-sheet', slotLabel: 'Storyboard Lookbook Sheet', cardinality: 'one', assetFileIds: selectedLookbookSheetFileIds(context, 'storyboard'), roles: ['storyboard-lookbook-sheet'], initializeFirst: true }] });
    if (guide.sections[0]?.slots[0]?.candidates.length === 0) {
      guide.notices.push({ code: 'CORE_GENERATION_STORYBOARD_LOOKBOOK_RECOMMENDED', message: 'No Storyboard Lookbook Sheet is available.', suggestion: 'Create a Storyboard Lookbook Sheet for consistent storyboard generations.' });
    }
    return guide;
  },
});
