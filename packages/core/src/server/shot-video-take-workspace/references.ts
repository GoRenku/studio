import { and, asc, eq, isNull } from 'drizzle-orm';
import type {
  GenerationReferenceCatalogItem,
  GenerationReferenceGuide,
  GenerationReferenceGuideSlot,
  GenerationReferenceSelection,
  GenerationModelDescriptor,
  GenerationRun,
  GenerationSpec,
} from '../../client/generation.js';
import type {
  SceneShotVideoTakeReferenceWorkspace,
  ShotVideoTakeReferenceCard,
  ShotVideoTakeCompletedReference,
  ShotVideoTakeGenericReference,
} from '../../client/shot-video-take-workspace.js';
import type { ProjectRelativePath } from '../../client/project.js';
import { readGenerationReferenceAssetFileRecord } from '../database/access/generation-references.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { listGenerationReferences } from '../generation/references.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  lookbookSheets,
  sceneDialogueAudio,
  sceneDialogueAudioTakes,
} from '../schema/index.js';

export function projectShotVideoTakeReferences(input: {
  session: DatabaseSession;
  guide: GenerationReferenceGuide;
  spec: GenerationSpec | null;
  model?: GenerationModelDescriptor;
  successfulRun?: GenerationRun;
  selectedShotId?: string;
}): SceneShotVideoTakeReferenceWorkspace {
  if (input.successfulRun) {
    return projectCompletedReferences(input.session, input.successfulRun);
  }
  const screenplay = readScreenplayDocumentFromSession(input.session);
  const selections = input.spec?.references ?? [];
  const general = slots(input.guide, 'take-media').map(({ slot }) => {
    const selection = selectionForSlot(selections, 'take-media', slot);
    const candidate = selection
      ? catalogCandidate(input.session, selection)
      : slot.eligibleCandidates[0] ?? null;
    return {
      id: selection?.id ?? `slot:take-media:${slot.id}`,
      kind: generalKind(slot.id),
      title: candidate?.label ?? slot.label,
      selected: Boolean(selection),
      card: candidate
        ? card(selection, 'take-media', slot, candidate)
        : emptyCard(`slot:take-media:${slot.id}`),
    };
  });
  const lookbookSlots = slots(input.guide, 'visual-language');
  const lookbook = uniqueAssetCandidates(
    lookbookSlots.flatMap(({ slot }) => slot.eligibleCandidates),
    input.session,
    selections
  ).map((candidate) => {
      const entry = slotEntryForCandidate(lookbookSlots, candidate);
      if (!entry) {
        throw new ProjectDataError(
          'CORE_SHOT_VIDEO_TAKE_REFERENCE_PROJECTION_INVALID',
          'A Lookbook reference candidate has no owning guide slot.'
        );
      }
      const selection = selectionForCandidate(selections, 'visual-language', entry.slot, candidate);
      const sheet = candidate.reference.kind === 'asset-file'
        ? input.session.db
            .select()
            .from(lookbookSheets)
            .where(and(eq(lookbookSheets.assetId, candidate.reference.assetId), isNull(lookbookSheets.discardedAt)))
            .get()
        : null;
      return {
        id: selectionId(selection, entry.slot, candidate),
        lookbookId: sheet?.lookbookId ?? candidate.owner?.id ?? '',
        lookbookSheetId: sheet?.id ?? null,
        title: candidate.label,
        selected: Boolean(selection),
        card: card(selection, 'visual-language', entry.slot, candidate),
      };
    });
  const castMembers = groupSlotsBySubject(
    slots(input.guide, 'cast')
  ).map(([castMemberId, castSlots]) => {
    const choices = uniqueAssetCandidates(
      castSlots.flatMap(({ slot }) => slot.eligibleCandidates),
      input.session,
      selections
    ).map((candidate) => {
      const entry = slotEntryForCandidate(castSlots, candidate)!;
      const selection = selectionForCandidate(selections, 'cast', entry.slot, candidate);
      return {
        id: selectionId(selection, entry.slot, candidate),
        castMemberId,
        assetId: candidate.reference.kind === 'asset-file' ? candidate.reference.assetId : null,
        title: candidate.label,
        selected: Boolean(selection),
        card: card(selection, 'cast', entry.slot, candidate),
      };
    });
    const member = screenplay?.cast.find((candidate) => candidate.id === castMemberId);
    const selected = choices.find((choice) => choice.selected);
    return {
      castMemberId,
      name: member?.name ?? castMemberId,
      role: member?.role ?? null,
      selectedForShot: Boolean(selected),
      characterSheets: choices,
      diagnostics: [],
    };
  });
  const locations = groupSlotsBySubject(
    slots(input.guide, 'location')
  ).map(([locationId, locationSlots]) => {
    const choices = uniqueAssetCandidates(
      locationSlots.flatMap(({ slot }) => slot.eligibleCandidates),
      input.session,
      selections
    ).map((candidate) => {
      const entry = slotEntryForCandidate(locationSlots, candidate)!;
      const selection = selectionForCandidate(selections, 'location', entry.slot, candidate);
      return {
        id: selectionId(selection, entry.slot, candidate),
        locationId,
        assetId: candidate.reference.kind === 'asset-file' ? candidate.reference.assetId : null,
        title: candidate.label,
        description: null,
        selected: Boolean(selection),
        card: card(selection, 'location', entry.slot, candidate),
      };
    });
    const location = screenplay?.locations.find((candidate) => candidate.id === locationId);
    return {
      locationId,
      name: location?.name ?? locationId,
      selectedForShot: choices.some((choice) => choice.selected),
      environmentSheets: choices,
      diagnostics: [],
    };
  });
  const dialogueAudio = slots(input.guide, 'dialogue').map(({ slot }) => {
    const dialogueId = slot.subject?.id ?? '';
    const block = screenplay?.acts
      .flatMap((act) => act.sequences)
      .flatMap((sequence) => sequence.scenes)
      .flatMap((scene) => scene.blocks)
      .find((candidate) => candidate.type === 'dialogue' && candidate.dialogueId === dialogueId);
    const castMemberId = block?.type === 'dialogue' ? block.castMemberId ?? null : null;
    const speakerName = screenplay?.cast.find((member) => member.id === castMemberId)?.name ?? 'Dialogue';
    const selected = slot.eligibleCandidates
      .map((candidate) => ({ candidate, selection: selectionForCandidate(selections, 'dialogue', slot, candidate) }))
      .find(({ selection }) => selection);
    const takes = input.session.db
      .select({ take: sceneDialogueAudioTakes })
      .from(sceneDialogueAudioTakes)
      .innerJoin(sceneDialogueAudio, eq(sceneDialogueAudio.id, sceneDialogueAudioTakes.sceneDialogueAudioId))
      .where(and(eq(sceneDialogueAudio.dialogueId, dialogueId), isNull(sceneDialogueAudioTakes.discardedAt)))
      .orderBy(asc(sceneDialogueAudioTakes.createdAt), asc(sceneDialogueAudioTakes.id))
      .all();
    const selectedReference = selected?.candidate.reference;
    const selectedTake = selectedReference?.kind === 'asset-file'
      ? takes.find(({ take }) => take.assetFileId === selectedReference.assetFileId)?.take
      : null;
    const candidate = selected?.candidate ?? slot.eligibleCandidates[0];
    const selection = selected?.selection ?? (candidate
      ? selectionForCandidate(selections, 'dialogue', slot, candidate)
      : undefined);
    const emptyCard: ShotVideoTakeReferenceCard = {
      state: 'unavailable',
      selectionId: `candidate:dialogue:${dialogueId}`,
      defaultIncluded: false,
      included: false,
      required: false,
      previews: [],
      diagnostics: [],
    };
    return {
      selectionId: candidate ? selectionId(selection, slot, candidate) : emptyCard.selectionId,
      dialogueId,
      castMemberId,
      speakerName,
      plainText: block?.type === 'dialogue' ? block.lines.join('\n') : '',
      audioState: selectedTake ? 'ready' as const : takes.length > 0 ? 'no-selected-take' as const : 'not-generated' as const,
      selectedTake: selectedTake
        ? {
            takeId: selectedTake.id,
            takeLabel: `Take ${takes.findIndex(({ take }) => take.id === selectedTake.id) + 1}`,
            createdAt: selectedTake.createdAt,
            assetId: selectedTake.assetId,
            assetFileId: selectedTake.assetFileId,
          }
        : null,
      availableTakes: takes.flatMap(({ take }) => {
        const takeCandidate = slot.eligibleCandidates.find((candidate) =>
          candidate.reference.kind === 'asset-file' &&
          candidate.reference.assetFileId === take.assetFileId
        );
        if (!takeCandidate) {
          return [];
        }
        const takeSelection = selectionForCandidate(
          selections,
          'dialogue',
          slot,
          takeCandidate
        );
        return [{
          takeId: take.id,
          selectionId: selectionId(takeSelection, slot, takeCandidate),
          selection: {
            placement: {
              kind: 'slot' as const,
              sectionId: 'dialogue',
              slotId: slot.id,
              ...(slot.subject ? { subject: slot.subject } : {}),
            },
            reference: takeCandidate.reference,
            ...(takeSelection?.providerField
              ? { providerField: takeSelection.providerField }
              : {}),
          },
        }];
      }),
      takeCount: takes.length,
      defaultIncluded: Boolean(selection),
      included: Boolean(selection),
      required: false,
      unavailableReason: null,
      card: candidate ? card(selection, 'dialogue', slot, candidate) : emptyCard,
    };
  });
  const selectedDialogueCount = dialogueAudio.filter((choice) => choice.included).length;
  const audioField = input.model?.fields.find(
    (field) => field.semantic?.kind === 'media' && field.semantic.role === 'audio'
  );
  const audioSupported = Boolean(audioField);
  const maxAudioCount = audioField?.media?.maximum ?? null;
  const overLimit = maxAudioCount !== null && selectedDialogueCount > maxAudioCount;
  const modelLabel = input.model?.label ?? input.spec?.model?.model ?? 'Selected model';
  return {
    kind: 'draft',
    general,
    genericReferences: selections
      .filter((selection) => selection.placement.kind === 'additional')
      .map((selection) => additionalReference(input.session, selection)),
    lookbook,
    dialogueAudio,
    dialogueAudioCapability: {
      state: !audioSupported ? 'unsupported' : overLimit ? 'over-limit' : 'ok',
      supported: audioSupported,
      selectedCount: selectedDialogueCount,
      maxCount: maxAudioCount,
      modelLabel,
      message: !audioSupported
        ? 'This model does not use audio references.'
        : overLimit
          ? `${modelLabel} allows up to ${maxAudioCount} audio references per generation.`
          : `${selectedDialogueCount} dialogue reference${selectedDialogueCount === 1 ? '' : 's'} selected`,
      diagnostics: [],
    },
    castMembers,
    locations,
  };
}

interface ShotVideoTakeGuideSlotEntry {
  slot: GenerationReferenceGuideSlot;
}

function slots(
  guide: GenerationReferenceGuide,
  sectionId: string
): ShotVideoTakeGuideSlotEntry[] {
  return guide.sections
    .filter((section) => section.id === sectionId)
    .flatMap((section) => section.slots.map((slot) => ({ slot })));
}

function groupSlotsBySubject(
  entries: ShotVideoTakeGuideSlotEntry[]
): Array<[string, ShotVideoTakeGuideSlotEntry[]]> {
  const grouped = new Map<string, ShotVideoTakeGuideSlotEntry[]>();
  for (const entry of entries) {
    const subjectId = entry.slot.subject?.id;
    if (!subjectId) {
      continue;
    }
    grouped.set(subjectId, [...(grouped.get(subjectId) ?? []), entry]);
  }
  return [...grouped];
}

function slotEntryForCandidate(
  entries: ShotVideoTakeGuideSlotEntry[],
  candidate: GenerationReferenceCatalogItem
): ShotVideoTakeGuideSlotEntry | undefined {
  return entries.find(({ slot }) =>
    slot.eligibleCandidates.some((entry) => sameReference(entry.reference, candidate.reference))
  );
}

function catalogCandidate(
  session: DatabaseSession,
  selection: GenerationReferenceSelection
): GenerationReferenceCatalogItem | null {
  if (selection.reference.kind !== 'asset-file') {
    return null;
  }
  return listGenerationReferences({
    session,
    assetFileIds: [selection.reference.assetFileId],
    limit: 1,
  }).items[0] ?? null;
}

function uniqueAssetCandidates(
  candidates: GenerationReferenceCatalogItem[],
  session: DatabaseSession,
  selections: GenerationReferenceSelection[]
): GenerationReferenceCatalogItem[] {
  const byAsset = new Map<string, GenerationReferenceCatalogItem[]>();
  for (const candidate of candidates) {
    const key = candidate.reference.kind === 'asset-file'
      ? candidate.reference.assetId
      : candidate.reference.projectRelativePath;
    byAsset.set(key, [...(byAsset.get(key) ?? []), candidate]);
  }
  return [...byAsset.values()].map((assetCandidates) => {
    const selected = assetCandidates.find((candidate) =>
      selections.some((selection) =>
        sameReference(selection.reference, candidate.reference)
      )
    );
    if (selected) {
      return selected;
    }
    return assetCandidates.find((candidate) => {
      if (candidate.reference.kind !== 'asset-file') {
        return false;
      }
      const record = readGenerationReferenceAssetFileRecord(session, {
        assetId: candidate.reference.assetId,
        assetFileId: candidate.reference.assetFileId,
      });
      return record?.file.role === 'primary' || record?.file.role === 'source';
    }) ?? assetCandidates[0]!;
  });
}

function generalKind(
  slotId: string
): 'first-frame' | 'last-frame' | 'video-prompt' | 'reference-image' {
  return slotId === 'first-frame' || slotId === 'last-frame' || slotId === 'video-prompt'
    ? slotId
    : 'reference-image' as const;
}

function selectionForCandidate(
  selections: GenerationReferenceSelection[],
  sectionId: string,
  slot: GenerationReferenceGuideSlot,
  candidate: GenerationReferenceCatalogItem
) {
  return selections.find((selection) =>
    selection.placement.kind === 'slot' &&
    selection.placement.sectionId === sectionId &&
    selection.placement.slotId === slot.id &&
    selection.placement.subject?.kind === slot.subject?.kind &&
    selection.placement.subject?.id === slot.subject?.id &&
    sameReference(selection.reference, candidate.reference)
  );
}

function selectionForSlot(
  selections: GenerationReferenceSelection[],
  sectionId: string,
  slot: GenerationReferenceGuideSlot
) {
  return selections.find((selection) =>
    selection.placement.kind === 'slot' &&
    selection.placement.sectionId === sectionId &&
    selection.placement.slotId === slot.id &&
    selection.placement.subject?.kind === slot.subject?.kind &&
    selection.placement.subject?.id === slot.subject?.id
  );
}

function card(
  selection: GenerationReferenceSelection | undefined,
  sectionId: string,
  slot: GenerationReferenceGuideSlot,
  candidate: GenerationReferenceCatalogItem
): ShotVideoTakeReferenceCard {
  const included = Boolean(selection);
  return {
    state: included ? 'selected-ready' : 'available',
    selectionId: selectionId(selection, slot, candidate),
    defaultIncluded: false,
    included,
    required: false,
    previews: candidate.mediaKind === 'image' && candidate.reference.kind === 'asset-file'
      ? [{
          selectionId: selectionId(selection, slot, candidate),
          assetId: candidate.reference.assetId,
          assetFileId: candidate.reference.assetFileId,
          projectRelativePath: candidate.projectRelativePath as ProjectRelativePath,
          title: candidate.label,
          alt: candidate.label,
        }]
      : [],
    diagnostics: [],
    selection: {
      placement: {
        kind: 'slot',
        sectionId,
        slotId: slot.id,
        ...(slot.subject ? { subject: slot.subject } : {}),
      },
      reference: candidate.reference,
      ...(selection?.providerField
        ? { providerField: selection.providerField }
        : {}),
    },
  };
}

function selectionId(
  selection: GenerationReferenceSelection | undefined,
  slot: GenerationReferenceGuideSlot,
  candidate: GenerationReferenceCatalogItem
) {
  if (selection) {
    return selection.id;
  }
  const referenceId = candidate.reference.kind === 'asset-file'
    ? candidate.reference.assetFileId
    : candidate.reference.projectRelativePath;
  return ['candidate', slot.subject?.id ?? 'shared', slot.id, referenceId].join(':');
}

function sameReference(
  left: GenerationReferenceSelection['reference'],
  right: GenerationReferenceSelection['reference']
): boolean {
  return left.kind === right.kind && (
    left.kind === 'asset-file' && right.kind === 'asset-file'
      ? left.assetId === right.assetId && left.assetFileId === right.assetFileId
      : left.kind === 'project-file' && right.kind === 'project-file' && left.projectRelativePath === right.projectRelativePath
  );
}

function emptyCard(selectionId: string): ShotVideoTakeReferenceCard {
  return {
    state: 'unavailable',
    selectionId,
    defaultIncluded: false,
    included: false,
    required: false,
    previews: [],
    diagnostics: [],
  };
}

function additionalReference(
  session: DatabaseSession,
  selection: GenerationReferenceSelection
): ShotVideoTakeGenericReference {
  const candidate = catalogCandidate(session, selection);
  return {
    selectionId: selection.id,
    reference: selection.reference,
    title: candidate?.label ?? 'Unavailable reference',
    mediaKind: candidate?.mediaKind ?? mediaKindForSelection(selection),
    available: Boolean(candidate),
  };
}

function projectCompletedReferences(
  session: DatabaseSession,
  run: GenerationRun
): SceneShotVideoTakeReferenceWorkspace {
  const usedReferences: ShotVideoTakeCompletedReference[] = run.specSnapshot.references.map(
    (selection) => {
      const resolved = catalogCandidate(session, selection);
      const placement = selection.placement.kind === 'slot'
        ? selection.placement
        : null;
      return {
        selectionId: selection.id,
        sectionId: placement?.sectionId ?? null,
        slotId: placement?.slotId ?? null,
        ...(placement?.subject ? { subject: placement.subject } : {}),
        title: resolved?.label ?? 'Unavailable reference',
        mediaKind: resolved?.mediaKind ?? mediaKindForSelection(selection),
        assetId: selection.reference.kind === 'asset-file'
          ? selection.reference.assetId
          : null,
        assetFileId: selection.reference.kind === 'asset-file'
          ? selection.reference.assetFileId
          : null,
        ...(selection.providerField
          ? { providerField: selection.providerField }
          : {}),
        projectRelativePath: resolved?.projectRelativePath ??
          (selection.reference.kind === 'project-file'
            ? selection.reference.projectRelativePath
            : null),
        available: Boolean(resolved),
      };
    }
  );
  return {
    kind: 'completed',
    successfulRunId: run.id,
    usedReferences,
  };
}

function mediaKindForSelection(
  selection: GenerationReferenceSelection
): 'image' | 'audio' | 'video' {
  if (selection.reference.kind !== 'project-file') {
    return 'image';
  }
  const path = selection.reference.projectRelativePath.toLowerCase();
  if (/\.(wav|mp3|m4a)$/.test(path)) {
    return 'audio';
  }
  if (/\.(mp4|mov)$/.test(path)) {
    return 'video';
  }
  return 'image';
}
