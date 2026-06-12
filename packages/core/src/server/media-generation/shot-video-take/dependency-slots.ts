import type {
  MediaGenerationDependencySlot,
  SceneShotMediaGenerationTarget,
  ShotVideoTakeInputModeId,
} from '../../../client/index.js';
import {
  castCharacterSheetDependencySlot,
  locationEnvironmentSheetDependencySlot,
  lookbookSheetDependencySlot,
  shotVideoInputDependencySlot,
} from '../dependency-slot-definitions.js';

export interface ShotVideoTakeDependencySlotInput {
  target: SceneShotMediaGenerationTarget;
  inputModeId: ShotVideoTakeInputModeId;
  selectedCast: Array<{ id: string; name: string }>;
  selectedLocations: Array<{ id: string; name: string }>;
  activeLookbook: { id: string; name: string } | null;
  customReferenceInputs: Array<{ id: string; title: string }>;
}

export function declareShotVideoTakeDependencySlots(
  input: ShotVideoTakeDependencySlotInput
): MediaGenerationDependencySlot[] {
  return [
    ...shotVideoInputModeSlots(input),
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
        required: true,
        reason:
          'The selected video model route requires selected reference images.',
      })
    );
  }

  return [];
}

function shotVideoReferenceContextSlots(
  input: ShotVideoTakeDependencySlotInput
): MediaGenerationDependencySlot[] {
  const requiredForReferenceRoute = input.inputModeId === 'reference';
  const contextReason = requiredForReferenceRoute
    ? 'The selected reference-video route uses this selected reference image.'
    : 'This selected reference helps author and inspect planned shot inputs.';

  return [
    ...(input.activeLookbook
      ? [
          lookbookSheetDependencySlot({
            lookbookId: input.activeLookbook.id,
            lookbookName: input.activeLookbook.name,
            required: requiredForReferenceRoute,
            reason: contextReason,
          }),
        ]
      : []),
    ...input.selectedCast.map((castMember) =>
      castCharacterSheetDependencySlot({
        castMemberId: castMember.id,
        castMemberName: castMember.name,
        required: requiredForReferenceRoute,
        reason: contextReason,
      })
    ),
    ...input.selectedLocations.map((location) =>
      locationEnvironmentSheetDependencySlot({
        locationId: location.id,
        locationName: location.name,
        required: requiredForReferenceRoute,
        reason: contextReason,
      })
    ),
  ];
}
