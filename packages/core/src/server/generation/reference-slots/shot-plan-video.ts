import type { BuildGenerationPurposeInput } from '../purpose-contract.js';
import {
  dialogueAudioFileIds,
  type GuideSlotDefinition,
} from '../purpose-guide.js';

export function shotPlanVideoInputSlots(
  context: BuildGenerationPurposeInput
): GuideSlotDefinition[] {
  const slots: GuideSlotDefinition[] = [
    {
      sectionId: 'video-inputs',
      sectionLabel: 'Video Inputs',
      slotId: 'first-frame',
      slotLabel: 'First Frame',
      mediaKind: 'image',
    },
    {
      sectionId: 'video-inputs',
      sectionLabel: 'Video Inputs',
      slotId: 'last-frame',
      slotLabel: 'Last Frame',
      mediaKind: 'image',
    },
    {
      sectionId: 'video-inputs',
      sectionLabel: 'Video Inputs',
      slotId: 'video-storyboard',
      slotLabel: 'Video Storyboard',
      mediaKind: 'image',
    },
    {
      sectionId: 'video-inputs',
      sectionLabel: 'Video Inputs',
      slotId: 'previs',
      slotLabel: 'Previs',
      mediaKind: 'video',
    },
  ];
  const dialogueIds =
    (context.facts?.sceneDialogueIds as string[] | undefined) ?? [];
  dialogueIds.forEach((dialogueId) => {
    slots.push({
      sectionId: 'dialogue',
      sectionLabel: 'Dialogue',
      slotId: 'dialogue-audio',
      slotLabel: 'Dialogue Audio',
      subject: { kind: 'sceneDialogue', id: dialogueId },
      assetFileIds: dialogueAudioFileIds(context, dialogueId),
      mediaKind: 'audio',
    });
  });
  return slots;
}
