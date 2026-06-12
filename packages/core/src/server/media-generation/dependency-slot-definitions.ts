import type {
  MediaGenerationDependencySlot,
  SceneShotMediaGenerationTarget,
  ShotVideoTakeInputKind,
  ShotVideoTakeInputSubjectKind,
} from '../../client/index.js';
import {
  castCharacterSheetDependencyId,
  locationEnvironmentSheetDependencyId,
  lookbookSheetDependencyId,
  shotVideoInputDependencyId,
} from './dependency-identifiers.js';

export function castCharacterSheetDependencySlot(input: {
  castMemberId: string;
  castMemberName: string;
  required: boolean;
  reason: string;
}): MediaGenerationDependencySlot {
  return {
    dependencyId: castCharacterSheetDependencyId(input.castMemberId),
    dependencyKind: 'cast-character-sheet',
    label: `${input.castMemberName} character sheet`,
    dependencyTarget: { kind: 'castMember', id: input.castMemberId },
    selector: {
      kind: 'asset-relationship',
      target: { kind: 'castMember', castMemberId: input.castMemberId },
      role: 'character_sheet',
      mediaKind: 'image',
      selectionPolicy: 'selected-or-default',
    },
    required: input.required,
    reason: input.reason,
  };
}

export function locationEnvironmentSheetDependencySlot(input: {
  locationId: string;
  locationName: string;
  required: boolean;
  reason: string;
}): MediaGenerationDependencySlot {
  return {
    dependencyId: locationEnvironmentSheetDependencyId(input.locationId),
    dependencyKind: 'location-environment-sheet',
    label: `${input.locationName} location sheet`,
    dependencyTarget: { kind: 'location', id: input.locationId },
    selector: {
      kind: 'asset-relationship',
      target: { kind: 'location', locationId: input.locationId },
      role: 'environment_sheet',
      mediaKind: 'image',
      fileRole: 'composite',
      selectionPolicy: 'selected-or-default',
    },
    required: input.required,
    reason: input.reason,
  };
}

export function lookbookSheetDependencySlot(input: {
  lookbookId: string;
  lookbookName: string;
  lookbookSheetId?: string;
  required: boolean;
  reason: string;
}): MediaGenerationDependencySlot {
  return {
    dependencyId: lookbookSheetDependencyId(input.lookbookId),
    dependencyKind: 'lookbook-sheet',
    label: `${input.lookbookName} Lookbook sheet`,
    dependencyTarget: { kind: 'lookbook', id: input.lookbookId },
    selector: {
      kind: 'lookbook-sheet',
      lookbookId: input.lookbookId,
      ...(input.lookbookSheetId ? { lookbookSheetId: input.lookbookSheetId } : {}),
      selectionPolicy: 'selected-or-default',
    },
    required: input.required,
    reason: input.reason,
  };
}

export function shotVideoInputDependencySlot(input: {
  kind:
    | 'first-frame'
    | 'last-frame'
    | 'reference-image'
    | 'multi-shot-storyboard-sheet';
  target: SceneShotMediaGenerationTarget;
  subjectKind?: ShotVideoTakeInputSubjectKind;
  subjectId?: string;
  label?: string;
  required: boolean;
  reason: string;
}): MediaGenerationDependencySlot {
  return {
    dependencyId: shotVideoInputDependencyId(input),
    dependencyKind: input.kind,
    label: input.label ?? shotInputDependencyLabel(input.kind),
    dependencyTarget: input.target,
    selector: {
      kind: 'shot-video-input',
      inputKind: input.kind as ShotVideoTakeInputKind,
      productionGroupId: input.target.productionGroupId ?? input.target.id,
      shotIds: input.target.shotIds,
      ...(input.subjectKind ? { subjectKind: input.subjectKind } : {}),
      ...(input.subjectId ? { subjectId: input.subjectId } : {}),
    },
    required: input.required,
    reason: input.reason,
  };
}

function shotInputDependencyLabel(kind: string): string {
  if (kind === 'first-frame') {
    return 'First frame';
  }
  if (kind === 'last-frame') {
    return 'Last frame';
  }
  if (kind === 'multi-shot-storyboard-sheet') {
    return 'Storyboard sheet';
  }
  return 'Reference image';
}
