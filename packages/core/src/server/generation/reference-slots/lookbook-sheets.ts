import type { BuildGenerationPurposeInput } from '../purpose-contract.js';
import { lookbookSheetFileIds, type GuideSlotDefinition } from '../purpose-guide.js';

export function productionLookbookSheetSlot(
  context: BuildGenerationPurposeInput
): GuideSlotDefinition {
  return {
    sectionId: 'visual-language',
    sectionLabel: 'Visual Language',
    slotId: 'production-lookbook-sheet',
    slotLabel: 'Production Lookbook Sheet',
    assetFileIds: lookbookSheetFileIds(context, 'production'),
    roles: ['video-lookbook-sheet'],
  };
}

export function storyboardLookbookSheetSlot(
  context: BuildGenerationPurposeInput
): GuideSlotDefinition {
  return {
    sectionId: 'visual-language',
    sectionLabel: 'Visual Language',
    slotId: 'storyboard-lookbook-sheet',
    slotLabel: 'Storyboard Lookbook Sheet',
    assetFileIds: lookbookSheetFileIds(context, 'storyboard'),
    roles: ['storyboard-lookbook-sheet'],
  };
}
