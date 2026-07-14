import { defineGenerationPurpose } from '../purpose-factory.js';
import { listSelectedGenerationReferenceFileIds } from '../../database/access/generation-references.js';
import { buildReferenceGuide, selectedLookbookSheetFileIds, type GuideSlotDefinition } from '../purpose-guide.js';
export const sceneStoryboardSheetPurpose = defineGenerationPurpose({
  purpose: 'scene.storyboard-sheet', targetKind: 'scene', outputMediaKind: 'image', modelUse: 'any',
  settings: { fixed: [{ kind: 'aspect-ratio', value: '4:3' }, { kind: 'quality', value: 'high' }], recommended: [], recommendedModel: { provider: 'fal-ai', model: 'openai/gpt-image-2' } },
  async buildReferenceGuide(context) {
    const slots: GuideSlotDefinition[] = [{ sectionId: 'visual-language', sectionLabel: 'Visual Language', slotId: 'storyboard-lookbook-sheet', slotLabel: 'Storyboard Lookbook Sheet', cardinality: 'one', assetFileIds: selectedLookbookSheetFileIds(context, 'storyboard'), roles: ['storyboard-lookbook-sheet'], initializeFirst: true }];
    const sceneCastMemberIds = (context.facts?.sceneCastMemberIds as string[] | undefined) ?? [];
    const sceneLocationIds = (context.facts?.sceneLocationIds as string[] | undefined) ?? [];
    for (const id of sceneCastMemberIds) {
      const roles = ['storyboard-character-sheet', 'video-character-sheet', 'character-sheet'];
      slots.push({
        sectionId: 'cast',
        sectionLabel: 'Cast',
        slotId: 'character-sheet',
        slotLabel: 'Character Sheet',
        cardinality: 'one',
        subject: { kind: 'castMember', id },
        owner: { kind: 'castMember', id },
        roles,
        selectedAssetFileIds: listSelectedGenerationReferenceFileIds({
          session: context.session,
          owner: { kind: 'castMember', id },
          roles,
        }),
      });
    }
    for (const id of sceneLocationIds) {
      const roles = ['location-sheet', 'environment-sheet'];
      slots.push({
        sectionId: 'location',
        sectionLabel: 'Location',
        slotId: 'location-sheet',
        slotLabel: 'Location Sheet',
        cardinality: 'one',
        subject: { kind: 'location', id },
        owner: { kind: 'location', id },
        roles,
        selectedAssetFileIds: listSelectedGenerationReferenceFileIds({
          session: context.session,
          owner: { kind: 'location', id },
          roles,
        }),
      });
    }
    const guide = buildReferenceGuide({ context, slots });
    if (guide.sections[0]?.slots[0]?.candidates.length === 0) {
      guide.notices.push({ code: 'CORE_GENERATION_STORYBOARD_LOOKBOOK_RECOMMENDED', message: 'No Storyboard Lookbook Sheet is available.', suggestion: 'Create a Storyboard Lookbook Sheet for consistent storyboard generations.' });
    }
    return guide;
  },
});
