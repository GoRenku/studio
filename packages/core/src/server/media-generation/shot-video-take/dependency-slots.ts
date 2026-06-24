import type {
  MediaGenerationDependencySlot,
  SceneShotVideoTakeTarget,
  ShotVideoTakeInputModeId,
  ShotVideoTakeRequestedInput,
} from '../../../client/index.js';
import {
  castCharacterSheetDependencySlot,
  locationEnvironmentSheetDependencySlot,
  lookbookSheetDependencySlot,
  shotVideoInputDependencySlot,
} from '../dependency-slot-definitions.js';

export interface ShotVideoTakeDependencySlotInput {
  target: SceneShotVideoTakeTarget;
  inputModeId: ShotVideoTakeInputModeId;
  selectedCast: Array<{ id: string; name: string; isVoiceOver?: boolean }>;
  selectedLocations: Array<{ id: string; name: string }>;
  activeLookbook: { id: string; name: string; selectedSheetId?: string | null } | null;
  customReferenceInputs: Array<{ id: string; title: string }>;
  referencedLocationSheetAssetIds: Record<string, string[]>;
  availableLocationSheetAssetIds?: Record<string, string[]>;
  requestedInputs?: ShotVideoTakeRequestedInput[];
  requiresMultiShotStoryboardSheet?: boolean;
}

export function declareShotVideoTakeDependencySlots(
  input: ShotVideoTakeDependencySlotInput
): MediaGenerationDependencySlot[] {
  return [
    ...shotVideoInputModeSlots(input),
    ...(input.requiresMultiShotStoryboardSheet
        ? [
            shotVideoInputDependencySlot({
              kind: 'multi-shot-storyboard-sheet',
              target: input.target,
              required: false,
              reason:
                'This generated multi-shot storyboard reference helps preserve continuity across the take.',
            }),
          ]
      : []),
    ...(input.requestedInputs ?? []).map((requestedInput) =>
      requestedShotVideoInputSlot({
        declarationInput: input,
        requestedInput,
      })
    ),
    ...shotVideoReferenceContextSlots(input),
  ];
}

function shotVideoInputModeSlots(
  input: ShotVideoTakeDependencySlotInput
): MediaGenerationDependencySlot[] {
  if (input.inputModeId === 'text-only') {
    return [];
  }

  if (input.inputModeId === 'first-frame') {
    return [
      shotVideoInputDependencySlot({
        kind: 'first-frame',
        target: input.target,
        required: true,
        reason:
          'The selected video model route requires a first-frame image input.',
      }),
    ];
  }

  if (input.inputModeId === 'first-last-frame') {
    return [
      shotVideoInputDependencySlot({
        kind: 'first-frame',
        target: input.target,
        required: true,
        reason:
          'The selected video model route requires a first-frame image input.',
      }),
      shotVideoInputDependencySlot({
        kind: 'last-frame',
        target: input.target,
        required: true,
        reason:
          'The selected video model route requires a last-frame image input.',
      }),
    ];
  }

  if (input.inputModeId === 'reference') {
    return input.customReferenceInputs.map((reference) =>
      shotVideoInputDependencySlot({
        kind: 'reference-image',
        target: input.target,
        subjectKind: 'asset',
        subjectId: reference.id,
        label: reference.title,
        required: false,
        reason:
          'This selected reference image helps author and inspect planned shot inputs.',
      })
    );
  }

  return [];
}

function shotVideoReferenceContextSlots(
  input: ShotVideoTakeDependencySlotInput
): MediaGenerationDependencySlot[] {
  if (!input.activeLookbook && !input.selectedCast.length && !input.selectedLocations.length) {
    return [];
  }
  const contextReason =
    'This selected reference helps author and inspect planned shot inputs.';

  return [
    ...(input.activeLookbook
      ? [
          lookbookSheetDependencySlot({
            lookbookId: input.activeLookbook.id,
            lookbookName: input.activeLookbook.name,
            ...(input.activeLookbook.selectedSheetId
              ? { lookbookSheetId: input.activeLookbook.selectedSheetId }
              : {}),
            required: false,
            reason: contextReason,
          }),
        ]
      : []),
    ...input.selectedCast
      .filter((castMember) => !castMember.isVoiceOver)
      .map((castMember) =>
        castCharacterSheetDependencySlot({
          castMemberId: castMember.id,
          castMemberName: castMember.name,
          required: false,
          reason: contextReason,
        })
      ),
    ...input.selectedLocations.flatMap((location) => {
      const referencedAssetIds =
        input.referencedLocationSheetAssetIds[location.id] ?? [];
      if (referencedAssetIds.length > 0) {
        return referencedAssetIds.map((assetId) =>
          locationEnvironmentSheetDependencySlot({
            locationId: location.id,
            locationName: location.name,
            assetId,
            required: false,
            reason: contextReason,
          })
        );
      }
      const availableAssetIds =
        input.availableLocationSheetAssetIds?.[location.id] ?? [];
      return availableAssetIds.length > 0
        ? []
        : [
            locationEnvironmentSheetDependencySlot({
              locationId: location.id,
              locationName: location.name,
              required: false,
              reason: contextReason,
            }),
          ];
    }),
  ];
}

function requestedShotVideoInputSlot(input: {
  declarationInput: ShotVideoTakeDependencySlotInput;
  requestedInput: ShotVideoTakeRequestedInput;
}): MediaGenerationDependencySlot {
  const subjectLabel =
    input.requestedInput.subjectKind && input.requestedInput.subjectId
      ? ` for ${input.requestedInput.subjectKind} ${input.requestedInput.subjectId}`
      : '';
  const reason =
    input.requestedInput.note?.trim() ||
    `Requested ${input.requestedInput.kind}${subjectLabel} is not selected for the final video take.`;
  if (
    input.requestedInput.kind === 'character-sheet' &&
    input.requestedInput.subjectKind === 'cast-member' &&
    input.requestedInput.subjectId
  ) {
    const castMember = input.declarationInput.selectedCast.find(
      (candidate) => candidate.id === input.requestedInput.subjectId
    );
    return castCharacterSheetDependencySlot({
      castMemberId: input.requestedInput.subjectId,
      castMemberName: castMember?.name ?? input.requestedInput.subjectId,
      required: false,
      reason,
    });
  }
  if (
    input.requestedInput.kind === 'location-sheet' &&
    input.requestedInput.subjectKind === 'location' &&
    input.requestedInput.subjectId
  ) {
    const location = input.declarationInput.selectedLocations.find(
      (candidate) => candidate.id === input.requestedInput.subjectId
    );
    return locationEnvironmentSheetDependencySlot({
      locationId: input.requestedInput.subjectId,
      locationName: location?.name ?? input.requestedInput.subjectId,
      required: false,
      reason,
    });
  }
  if (
    input.requestedInput.kind === 'lookbook-sheet' &&
    input.requestedInput.subjectKind === 'lookbook' &&
    input.requestedInput.subjectId
  ) {
    const activeLookbook = input.declarationInput.activeLookbook;
    const requestedLookbookSheetId =
      activeLookbook?.id === input.requestedInput.subjectId
        ? activeLookbook.selectedSheetId
        : undefined;
    return lookbookSheetDependencySlot({
      lookbookId: input.requestedInput.subjectId,
      lookbookName:
        activeLookbook?.id === input.requestedInput.subjectId
          ? activeLookbook.name
          : input.requestedInput.subjectId,
      ...(requestedLookbookSheetId
        ? { lookbookSheetId: requestedLookbookSheetId }
        : {}),
      required: false,
      reason,
    });
  }
  if (
    input.requestedInput.kind === 'first-frame' ||
    input.requestedInput.kind === 'last-frame' ||
    input.requestedInput.kind === 'reference-image' ||
    input.requestedInput.kind === 'multi-shot-storyboard-sheet'
  ) {
    return shotVideoInputDependencySlot({
      kind: input.requestedInput.kind,
      target: input.declarationInput.target,
      ...(input.requestedInput.subjectKind
        ? { subjectKind: input.requestedInput.subjectKind }
        : {}),
      ...(input.requestedInput.subjectId
        ? { subjectId: input.requestedInput.subjectId }
        : {}),
      required: false,
      reason,
    });
  }
  return {
    dependencyId: `${input.requestedInput.kind}:manual:${input.requestedInput.subjectId ?? 'unscoped'}`,
    dependencyKind: 'manual-attachment',
    label: input.requestedInput.kind,
    dependencyTarget: input.declarationInput.target,
    selector: {
      kind: 'manual-attachment',
      target: input.declarationInput.target,
    },
    required: false,
    reason,
  };
}
