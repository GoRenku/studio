import { defineGenerationPurpose, noSettings } from '../purpose-factory.js';
import { buildReferenceGuide, dialogueAudioFileIds, selectedLookbookSheetFileIds, type GuideSlotDefinition } from '../purpose-guide.js';
export const shotVideoTakePurpose = defineGenerationPurpose({
  purpose: 'shot.video-take', targetKind: 'sceneShotVideoTake', outputMediaKind: 'video', modelUse: 'any', settings: noSettings,
  async buildReferenceGuide(context) {
    const shotContexts = (context.facts?.shotContexts as Array<{
      shotId: string;
      castMemberIds: string[];
      locationIds: string[];
      dialogueIds: string[];
    }> | undefined) ?? [];
    const structureMode = context.facts?.structureMode === 'multi-cut'
      ? 'multi-cut'
      : 'continuous';
    const sceneCastMemberIds = (context.facts?.sceneCastMemberIds as string[] | undefined) ?? [];
    const sceneLocationIds = (context.facts?.sceneLocationIds as string[] | undefined) ?? [];
    const directions = structureMode === 'multi-cut'
      ? shotContexts
      : [{
          shotId: '',
          castMemberIds: [...new Set(shotContexts.flatMap((shot) => shot.castMemberIds))],
          locationIds: [...new Set(shotContexts.flatMap((shot) => shot.locationIds))],
          dialogueIds: [...new Set(shotContexts.flatMap((shot) => shot.dialogueIds))],
        }];
    const slots: GuideSlotDefinition[] = [];
    for (const direction of directions) {
      const scope = direction.shotId
        ? { kind: 'shot', id: direction.shotId }
        : undefined;
      slots.push(
        { sectionId: 'shot', sectionLabel: 'Shot', slotId: 'first-frame', slotLabel: 'First Frame', cardinality: 'one', scope, roles: ['first-frame'] },
        { sectionId: 'shot', sectionLabel: 'Shot', slotId: 'last-frame', slotLabel: 'Last Frame', cardinality: 'one', scope, roles: ['last-frame'] },
        { sectionId: 'shot', sectionLabel: 'Shot', slotId: 'video-prompt-sheet', slotLabel: 'Video Prompt Sheet', cardinality: 'one', scope, roles: ['video-prompt-sheet'] },
        { sectionId: 'shot', sectionLabel: 'Shot', slotId: 'general-reference', slotLabel: 'General References', cardinality: 'many', scope, assetFileIds: [] },
        { sectionId: 'lookbook', sectionLabel: 'Lookbook', slotId: 'video-lookbook-sheet', slotLabel: 'Video Lookbook Sheets', cardinality: 'many', scope, assetFileIds: selectedLookbookSheetFileIds(context, 'movie') },
      );
      for (const id of sceneCastMemberIds) {
        slots.push({ sectionId: 'cast', sectionLabel: 'Cast', slotId: 'video-character-sheet', slotLabel: 'Video Character Sheet', cardinality: 'one', scope, subject: { kind: 'castMember', id }, owner: { kind: 'castMember', id }, roles: ['video-character-sheet', 'character-sheet'], initializeFirst: direction.castMemberIds.includes(id) });
      }
      for (const id of sceneLocationIds) {
        slots.push({ sectionId: 'location', sectionLabel: 'Location', slotId: 'location-sheet', slotLabel: 'Location Sheet', cardinality: 'one', scope, subject: { kind: 'location', id }, owner: { kind: 'location', id }, roles: ['location-sheet', 'environment-sheet'], initializeFirst: direction.locationIds.includes(id) });
      }
      for (const id of direction.dialogueIds) {
        slots.push({ sectionId: 'dialogue', sectionLabel: 'Dialogue', slotId: 'dialogue-audio', slotLabel: 'Dialogue Audio', cardinality: 'one', scope, subject: { kind: 'sceneDialogue', id }, assetFileIds: dialogueAudioFileIds(context, id), roles: ['dialogue-audio'], mediaKind: 'audio' });
      }
    }
    return buildReferenceGuide({ context, slots });
  },
});
