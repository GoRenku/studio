import type { JsonValue } from '../../../client/generation.js';
import { readAssetFileRecord } from '../../database/access/asset-files.js';
import {
  readGenerationRunRecord,
  readGenerationSpecRecord,
} from '../../database/access/media-generation.js';
import {
  dialogueAudioFileIds,
  lookbookSheetFileIds,
  type GuideSlotDefinition,
} from '../purpose-guide.js';
import { listGenerationReferences } from '../references.js';
import type { BuildGenerationPurposeInput } from '../purpose-contract.js';

const AUXILIARY_ASSET_TYPES = {
  'first-frame': 'shot_plan_video_first_frame',
  'last-frame': 'shot_plan_video_last_frame',
  'video-storyboard': 'shot_plan_video_storyboard',
} as const;

export function shotPlanVideoMethodSlots(
  context: BuildGenerationPurposeInput,
): GuideSlotDefinition[] {
  return [
    methodSlot(context, 'first-frame', 'First Frame'),
    methodSlot(context, 'last-frame', 'Last Frame'),
    methodSlot(context, 'video-storyboard', 'Video Storyboard'),
  ];
}

export function shotPlanDialogueAudioSlots(
  context: BuildGenerationPurposeInput,
): GuideSlotDefinition[] {
  return jsonStringArray(context.facts?.sceneDialogueIds).map((dialogueId) => ({
    sectionId: 'dialogue-audio',
    sectionLabel: 'Dialogue Audio',
    slotId: 'dialogue-audio',
    slotLabel: 'Dialogue Audio',
    subject: { kind: 'sceneDialogue', id: dialogueId },
    assetFileIds: dialogueAudioFileIds(context, dialogueId),
    mediaKind: 'audio',
  }));
}

export function shotPlanLookbookSlot(
  context: BuildGenerationPurposeInput,
): GuideSlotDefinition {
  return {
    sectionId: 'lookbook',
    sectionLabel: 'Lookbook',
    slotId: 'lookbook-sheet',
    slotLabel: 'Lookbook Sheet',
    assetFileIds: [
      ...lookbookSheetFileIds(context, 'production'),
      ...lookbookSheetFileIds(context, 'storyboard'),
    ],
  };
}

export function shotPlanImageSlots(
  context: BuildGenerationPurposeInput,
): GuideSlotDefinition[] {
  const shots = Array.isArray(context.facts?.authoredShotPlanShots)
    ? context.facts.authoredShotPlanShots
    : [];
  return shots.flatMap((shot): GuideSlotDefinition[] => {
    if (!isJsonRecord(shot) || typeof shot.id !== 'string') {
      return [];
    }
    const assetFileIds = jsonStringArray(shot.imageAssetFileIds);
    return [{
      sectionId: 'shot-images',
      sectionLabel: 'Shot Images',
      slotId: 'shot-image',
      slotLabel: typeof shot.title === 'string' && shot.title.trim()
        ? shot.title
        : 'Shot Image',
      subject: { kind: 'shot', id: shot.id },
      assetFileIds,
    }];
  });
}

function methodSlot(
  context: BuildGenerationPurposeInput,
  slotId: keyof typeof AUXILIARY_ASSET_TYPES,
  slotLabel: string,
): GuideSlotDefinition {
  return {
    sectionId: 'method-references',
    sectionLabel: 'Method References',
    slotId,
    slotLabel,
    assetFileIds: auxiliaryAssetFileIds(
      context,
      AUXILIARY_ASSET_TYPES[slotId],
    ),
  };
}

function auxiliaryAssetFileIds(
  context: BuildGenerationPurposeInput,
  assetType: string,
): string[] {
  const authoredShotPlanId =
    typeof context.facts?.authoredShotPlanId === 'string'
      ? context.facts.authoredShotPlanId
      : null;
  if (!authoredShotPlanId) {
    return [];
  }
  return listGenerationReferences({
    session: context.session,
    owner: { kind: 'project' },
    assetType,
    mediaKind: 'image',
    limit: 200,
  }).items.flatMap((candidate) => {
    if (
      candidate.reference.kind !== 'asset-file' ||
      sourceShotPlanId(context, candidate.reference.assetId, candidate.reference.assetFileId) !==
        authoredShotPlanId
    ) {
      return [];
    }
    return [candidate.reference.assetFileId];
  });
}

function sourceShotPlanId(
  context: BuildGenerationPurposeInput,
  assetId: string,
  assetFileId: string,
): string | null {
  const file = readAssetFileRecord(context.session, { assetId, assetFileId });
  if (!file) {
    return null;
  }
  if (file.sourceGenerationSpecId) {
    return readGenerationSpecRecord(
      context.session,
      file.sourceGenerationSpecId,
    )?.spec.authoredFrom?.id ?? null;
  }
  const candidate = listGenerationReferences({
    session: context.session,
    assetId,
    limit: 200,
  }).items.find((item) =>
    item.reference.kind === 'asset-file' &&
    item.reference.assetFileId === assetFileId
  );
  if (!candidate?.provenance.generationRunId) {
    return null;
  }
  return readGenerationRunRecord(
    context.session,
    candidate.provenance.generationRunId,
  )?.specSnapshot.authoredFrom?.id ?? null;
}

function jsonStringArray(value: JsonValue | undefined): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function isJsonRecord(
  value: JsonValue,
): value is { [key: string]: JsonValue } {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
