import { defineGenerationPurpose, noSettings } from '../purpose-factory.js';
import { buildReferenceGuide, domainAssetGroupsForRoles, lookbookSheetFileIds } from '../purpose-guide.js';

export const imageEditPurpose = defineGenerationPurpose({
  purpose: 'image.edit', targetKind: 'asset', outputMediaKind: 'image', modelUse: 'edit', settings: noSettings,
  async buildReferenceGuide(context) {
    const characterSheets = domainAssetGroupsForRoles(context, 'castMember', ['character-sheet']);
    const locationSheets = domainAssetGroupsForRoles(context, 'location', ['location-sheet', 'environment-sheet']);
    return buildReferenceGuide({ context, slots: [
      { sectionId: 'source', sectionLabel: 'Source', slotId: 'source-image', slotLabel: 'Source Image', assetId: context.target.id },
      ...characterSheets.map(({ owner, assetFileIds }) => ({ sectionId: 'cast', sectionLabel: 'Cast', slotId: 'character-sheet', slotLabel: 'Character Sheet', subject: owner, assetFileIds, roles: ['character-sheet'] })),
      ...locationSheets.map(({ owner, assetFileIds }) => ({ sectionId: 'location', sectionLabel: 'Location', slotId: 'location-sheet', slotLabel: 'Location Sheet', subject: owner, assetFileIds, roles: ['location-sheet', 'environment-sheet'] })),
      { sectionId: 'lookbook', sectionLabel: 'Lookbook', slotId: 'production-lookbook-sheet', slotLabel: 'Production Lookbook Sheet', assetFileIds: lookbookSheetFileIds(context, 'production') },
      { sectionId: 'lookbook', sectionLabel: 'Lookbook', slotId: 'storyboard-lookbook-sheet', slotLabel: 'Storyboard Lookbook Sheet', assetFileIds: lookbookSheetFileIds(context, 'storyboard') },
    ] });
  },
});
