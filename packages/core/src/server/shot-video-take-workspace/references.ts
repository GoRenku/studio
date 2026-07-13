import { and, asc, eq, isNull } from 'drizzle-orm';
import type {
  GenerationReferenceCatalogItem,
  GenerationReferenceGuide,
  GenerationReferenceGuideSlot,
  GenerationReferenceSelection,
  GenerationModelDescriptor,
  GenerationSpec,
} from '../../client/generation.js';
import type {
  ShotVideoTakeReferenceCard,
  ShotVideoTakeReferenceSections,
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
  selectedShotId?: string;
}): ShotVideoTakeReferenceSections {
  const screenplay = readScreenplayDocumentFromSession(input.session);
  const selections = input.spec?.references ?? [];
  const shotSlots = slots(input.guide, 'shot', input.selectedShotId);
  const general = selections.flatMap((selection) => {
    if (
      selection.placement.kind !== 'slot' ||
      selection.placement.sectionId !== 'shot' ||
      !scopeIsVisible(selection.placement.scope, input.selectedShotId)
    ) {
      return [];
    }
    const placement = selection.placement;
    const entry = shotSlots.find(({ slot, scope }) =>
      slot.id === placement.slotId &&
      scope?.kind === placement.scope?.kind &&
      scope?.id === placement.scope?.id
    );
    const candidate = catalogCandidate(input.session, selection);
    if (!entry || !candidate) {
      return [];
    }
    const kind = generalKind(entry.slot.id);
    return [{
      id: selection.id,
      kind,
      title: candidate.label,
      selected: selection.included,
      card: card(selection, entry.slot, entry.scope, candidate),
    }];
  });
  const lookbookSlots = slots(input.guide, 'lookbook', input.selectedShotId);
  const lookbook = uniqueAssetCandidates(
    lookbookSlots.flatMap(({ slot }) => slot.candidates),
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
      const selection = selectionForCandidate(selections, 'lookbook', entry.slot, entry.scope, candidate);
      const sheet = candidate.reference.kind === 'asset-file'
        ? input.session.db
            .select()
            .from(lookbookSheets)
            .where(and(eq(lookbookSheets.assetId, candidate.reference.assetId), isNull(lookbookSheets.discardedAt)))
            .get()
        : null;
      return {
        id: selectionId(selection, entry.slot, entry.scope, candidate),
        lookbookId: sheet?.lookbookId ?? candidate.owner?.id ?? '',
        lookbookSheetId: sheet?.id ?? null,
        title: candidate.label,
        selected: selection?.included ?? false,
        card: card(selection, entry.slot, entry.scope, candidate),
      };
    });
  const castMembers = groupSlotsBySubject(
    slots(input.guide, 'cast', input.selectedShotId)
  ).map(([castMemberId, castSlots]) => {
    const choices = uniqueAssetCandidates(
      castSlots.flatMap(({ slot }) => slot.candidates),
      input.session,
      selections
    ).map((candidate) => {
      const entry = slotEntryForCandidate(castSlots, candidate)!;
      const selection = selectionForCandidate(selections, 'cast', entry.slot, entry.scope, candidate);
      return {
        id: selectionId(selection, entry.slot, entry.scope, candidate),
        castMemberId,
        assetId: candidate.reference.kind === 'asset-file' ? candidate.reference.assetId : null,
        title: candidate.label,
        selected: selection?.included ?? false,
        defaultSelected: entry.slot.selections.some((defaultSelection) => sameReference(defaultSelection.reference, candidate.reference)),
        card: card(selection, entry.slot, entry.scope, candidate),
      };
    });
    const member = screenplay?.cast.find((candidate) => candidate.id === castMemberId);
    const selected = choices.find((choice) => choice.selected);
    const defaultChoice = choices.find((choice) => choice.defaultSelected);
    return {
      castMemberId,
      name: member?.name ?? castMemberId,
      role: member?.role ?? null,
      selectedForShot: input.spec ? Boolean(selected) : Boolean(defaultChoice),
      defaultSelectedForShot: Boolean(defaultChoice),
      selectedCharacterSheetAssetId: selected?.assetId ?? null,
      defaultCharacterSheetAssetId: defaultChoice?.assetId ?? null,
      characterSheets: choices,
      diagnostics: [],
    };
  });
  const locations = groupSlotsBySubject(
    slots(input.guide, 'location', input.selectedShotId)
  ).map(([locationId, locationSlots]) => {
    const choices = uniqueAssetCandidates(
      locationSlots.flatMap(({ slot }) => slot.candidates),
      input.session,
      selections
    ).map((candidate) => {
      const entry = slotEntryForCandidate(locationSlots, candidate)!;
      const selection = selectionForCandidate(selections, 'location', entry.slot, entry.scope, candidate);
      return {
        id: selectionId(selection, entry.slot, entry.scope, candidate),
        locationId,
        assetId: candidate.reference.kind === 'asset-file' ? candidate.reference.assetId : null,
        title: candidate.label,
        description: null,
        selected: selection?.included ?? false,
        card: card(selection, entry.slot, entry.scope, candidate),
      };
    });
    const location = screenplay?.locations.find((candidate) => candidate.id === locationId);
    const defaultSelectedForShot = locationSlots.some(({ slot }) =>
      slot.selections.some((selection) => selection.included)
    );
    return {
      locationId,
      name: location?.name ?? locationId,
      selectedForShot: input.spec
        ? choices.some((choice) => choice.selected)
        : defaultSelectedForShot,
      defaultSelectedForShot,
      selectedLocationSheetAssetId: choices.find((choice) => choice.selected)?.assetId ?? null,
      environmentSheets: choices,
      diagnostics: [],
    };
  });
  const dialogueAudio = slots(input.guide, 'dialogue', input.selectedShotId).map(({ slot, scope }) => {
    const dialogueId = slot.subject?.id ?? '';
    const block = screenplay?.acts
      .flatMap((act) => act.sequences)
      .flatMap((sequence) => sequence.scenes)
      .flatMap((scene) => scene.blocks)
      .find((candidate) => candidate.type === 'dialogue' && candidate.dialogueId === dialogueId);
    const castMemberId = block?.type === 'dialogue' ? block.castMemberId ?? null : null;
    const speakerName = screenplay?.cast.find((member) => member.id === castMemberId)?.name ?? 'Dialogue';
    const selected = slot.candidates
      .map((candidate) => ({ candidate, selection: selectionForCandidate(selections, 'dialogue', slot, scope, candidate) }))
      .find(({ selection }) => selection?.included);
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
    const candidate = selected?.candidate ?? slot.candidates[0];
    const selection = selected?.selection ?? (candidate
      ? selectionForCandidate(selections, 'dialogue', slot, scope, candidate)
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
      selectionId: candidate ? selectionId(selection, slot, scope, candidate) : emptyCard.selectionId,
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
        const takeCandidate = slot.candidates.find((candidate) =>
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
          scope,
          takeCandidate
        );
        return [{
          takeId: take.id,
          selectionId: selectionId(takeSelection, slot, scope, takeCandidate),
        }];
      }),
      takeCount: takes.length,
      defaultIncluded: selection?.included ?? false,
      included: selection?.included ?? false,
      required: false,
      unavailableReason: null,
      card: candidate ? card(selection, slot, scope, candidate) : emptyCard,
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
    general,
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

export function setShotVideoTakeReferenceSelection(input: {
  guide: GenerationReferenceGuide;
  selections: GenerationReferenceSelection[];
  selectionId: string;
  included: boolean;
}): GenerationReferenceSelection[] {
  const current = input.selections.find((selection) => selection.id === input.selectionId);
  if (current) {
    return input.selections.map((selection) =>
      selection.id === input.selectionId
        ? { ...selection, included: input.included }
        : selection
    );
  }
  for (const section of input.guide.sections) {
    for (const slot of section.slots) {
      for (const candidate of slot.candidates) {
        if (selectionId(undefined, slot, section.scope, candidate) !== input.selectionId) {
          continue;
        }
        const next: GenerationReferenceSelection = {
          id: input.selectionId,
          placement: {
            kind: 'slot',
            sectionId: section.id,
            slotId: slot.id,
            ...(section.scope ? { scope: section.scope } : {}),
            ...(slot.subject ? { subject: slot.subject } : {}),
          },
          included: input.included,
          reference: candidate.reference,
        };
        const withoutAlternate = slot.cardinality === 'one'
          ? input.selections.filter((selection) =>
              !samePlacement(selection, next)
            )
          : input.selections;
        return [...withoutAlternate, next];
      }
    }
  }
  throw new ProjectDataError(
    'CORE_SHOT_VIDEO_TAKE_REFERENCE_NOT_FOUND',
    `Shot Video Take reference selection was not found: ${input.selectionId}.`
  );
}

interface ShotVideoTakeGuideSlotEntry {
  slot: GenerationReferenceGuideSlot;
  scope: { kind: string; id: string } | undefined;
}

function slots(
  guide: GenerationReferenceGuide,
  sectionId: string,
  selectedShotId?: string
): ShotVideoTakeGuideSlotEntry[] {
  return guide.sections
    .filter((section) =>
      section.id === sectionId && scopeIsVisible(section.scope, selectedShotId)
    )
    .flatMap((section) => section.slots.map((slot) => ({ slot, scope: section.scope })));
}

function scopeIsVisible(
  scope: { kind: string; id: string } | undefined,
  selectedShotId: string | undefined
): boolean {
  return !scope || !selectedShotId || (
    scope.kind === 'shot' && scope.id === selectedShotId
  );
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
    slot.candidates.some((entry) => sameReference(entry.reference, candidate.reference))
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
        selection.included && sameReference(selection.reference, candidate.reference)
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
): 'first-frame' | 'last-frame' | 'video-prompt-sheet' | 'reference-image' {
  return slotId === 'first-frame' || slotId === 'last-frame' || slotId === 'video-prompt-sheet'
    ? slotId
    : 'reference-image' as const;
}

function selectionForCandidate(
  selections: GenerationReferenceSelection[],
  sectionId: string,
  slot: GenerationReferenceGuideSlot,
  scope: { kind: string; id: string } | undefined,
  candidate: GenerationReferenceCatalogItem
) {
  return selections.find((selection) =>
    selection.placement.kind === 'slot' &&
    selection.placement.sectionId === sectionId &&
    selection.placement.slotId === slot.id &&
    selection.placement.scope?.kind === scope?.kind &&
    selection.placement.scope?.id === scope?.id &&
    selection.placement.subject?.kind === slot.subject?.kind &&
    selection.placement.subject?.id === slot.subject?.id &&
    sameReference(selection.reference, candidate.reference)
  );
}

function card(
  selection: GenerationReferenceSelection | undefined,
  slot: GenerationReferenceGuideSlot,
  scope: { kind: string; id: string } | undefined,
  candidate: GenerationReferenceCatalogItem
): ShotVideoTakeReferenceCard {
  const defaultSelection = slot.selections.find((entry) => sameReference(entry.reference, candidate.reference));
  const included = selection?.included ?? false;
  return {
    state: included ? 'selected-ready' : selection ? 'not-selected' : 'available',
    selectionId: selectionId(selection, slot, scope, candidate),
    defaultIncluded: defaultSelection?.included ?? false,
    included,
    required: false,
    previews: candidate.mediaKind === 'image' && candidate.reference.kind === 'asset-file'
      ? [{
          selectionId: selectionId(selection, slot, scope, candidate),
          assetId: candidate.reference.assetId,
          assetFileId: candidate.reference.assetFileId,
          projectRelativePath: candidate.projectRelativePath as ProjectRelativePath,
          title: candidate.label,
          alt: candidate.label,
        }]
      : [],
    diagnostics: [],
  };
}

function selectionId(
  selection: GenerationReferenceSelection | undefined,
  slot: GenerationReferenceGuideSlot,
  scope: { kind: string; id: string } | undefined,
  candidate: GenerationReferenceCatalogItem
) {
  if (selection) {
    return selection.id;
  }
  const referenceId = candidate.reference.kind === 'asset-file'
    ? candidate.reference.assetFileId
    : candidate.reference.projectRelativePath;
  return ['candidate', scope?.id ?? 'shared', slot.subject?.id ?? '', slot.id, referenceId].join(':');
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

function samePlacement(
  left: GenerationReferenceSelection,
  right: GenerationReferenceSelection
): boolean {
  if (left.placement.kind !== 'slot' || right.placement.kind !== 'slot') {
    return false;
  }
  return (
    left.placement.sectionId === right.placement.sectionId &&
    left.placement.slotId === right.placement.slotId &&
    left.placement.scope?.kind === right.placement.scope?.kind &&
    left.placement.scope?.id === right.placement.scope?.id &&
    left.placement.subject?.kind === right.placement.subject?.kind &&
    left.placement.subject?.id === right.placement.subject?.id
  );
}
