import { and, eq, isNull } from 'drizzle-orm';
import type { BuildGenerationPurposeInput } from '../purpose-contract.js';
import { dialogueAudioFileIds, type GuideSlotDefinition } from '../purpose-guide.js';
import { sceneShotVideoTakeImages } from '../../schema/index.js';
import { characterSheetSlot, locationSheetSlot } from './domain-assets.js';
import { productionLookbookSheetSlot } from './lookbook-sheets.js';

interface TakeShotContext {
  castMemberIds: string[];
  locationIds: string[];
  dialogueIds: string[];
}

export function takeContinuitySlots(input: {
  context: BuildGenerationPurposeInput;
  includeOwnedMediaAndDialogue: boolean;
}): GuideSlotDefinition[] {
  const shotContexts = (input.context.facts?.shotContexts as TakeShotContext[] | undefined) ?? [];
  const castMemberIds = [...new Set(shotContexts.flatMap((shot) => shot.castMemberIds))];
  const locationIds = [...new Set(shotContexts.flatMap((shot) => shot.locationIds))];
  const dialogueIds = [...new Set(shotContexts.flatMap((shot) => shot.dialogueIds))];
  const slots: GuideSlotDefinition[] = [
    ...castMemberIds.map((castMemberId) => characterSheetSlot({
      context: input.context,
      castMemberId,
    })),
    ...locationIds.map((locationId) => locationSheetSlot({
      context: input.context,
      locationId,
    })),
    productionLookbookSheetSlot(input.context),
  ];
  if (!input.includeOwnedMediaAndDialogue) {
    return slots;
  }
  slots.push(
    takeImageSlot({ context: input.context, role: 'first-frame' }),
    takeImageSlot({ context: input.context, role: 'last-frame' }),
    takeImageSlot({ context: input.context, role: 'video-prompt' }),
    ...dialogueIds.map((dialogueId) => dialogueAudioSlot({
      context: input.context,
      dialogueId,
    }))
  );
  return slots;
}

export function takeImageSlot(input: {
  context: BuildGenerationPurposeInput;
  role: 'first-frame' | 'last-frame' | 'video-prompt';
}): GuideSlotDefinition {
  const labels = {
    'first-frame': 'First Frame',
    'last-frame': 'Last Frame',
    'video-prompt': 'Video Prompt Image',
  } as const;
  const providerRoles = {
    'first-frame': 'first-frame',
    'last-frame': 'last-frame',
    'video-prompt': 'reference-image',
  } as const;
  const assetFileIds = input.context.session.db
    .select({ assetFileId: sceneShotVideoTakeImages.assetFileId })
    .from(sceneShotVideoTakeImages)
    .where(and(
      eq(sceneShotVideoTakeImages.takeId, input.context.target.id),
      eq(sceneShotVideoTakeImages.role, input.role),
      isNull(sceneShotVideoTakeImages.discardedAt)
    ))
    .all()
    .map((row) => row.assetFileId);
  return {
    sectionId: 'take-media',
    sectionLabel: 'Take Media',
    slotId: input.role,
    slotLabel: labels[input.role],
    cardinality: 'one',
    assetFileIds,
    roles: [input.role],
    providerRole: providerRoles[input.role],
  };
}

export function dialogueAudioSlot(input: {
  context: BuildGenerationPurposeInput;
  dialogueId: string;
}): GuideSlotDefinition {
  return {
    sectionId: 'dialogue',
    sectionLabel: 'Dialogue',
    slotId: 'dialogue-audio',
    slotLabel: 'Dialogue Audio',
    cardinality: 'one',
    subject: { kind: 'sceneDialogue', id: input.dialogueId },
    assetFileIds: dialogueAudioFileIds(input.context, input.dialogueId),
    roles: ['dialogue-audio'],
    mediaKind: 'audio',
    providerRole: 'audio',
  };
}
