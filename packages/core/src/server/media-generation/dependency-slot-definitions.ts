import type {
  MediaGenerationDependencySlot,
  SceneShotVideoTakeTarget,
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
  assetId?: string;
  assetTitle?: string;
  required: boolean;
  reason: string;
}): MediaGenerationDependencySlot {
  return {
    dependencyId: locationEnvironmentSheetDependencyId(input.locationId, input.assetId),
    dependencyKind: 'location-environment-sheet',
    label: input.assetTitle
      ? `${input.locationName} Location Sheet: ${input.assetTitle}`
      : `${input.locationName} Location Sheet`,
    dependencyTarget: { kind: 'location', id: input.locationId },
    selector: {
      kind: 'asset-relationship',
      target: { kind: 'location', locationId: input.locationId },
      ...(input.assetId ? { assetId: input.assetId } : {}),
      role: 'environment_sheet',
      mediaKind: 'image',
      fileRole: 'primary',
      selectionPolicy: 'selected-only',
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
    | 'multi-shot-storyboard-sheet'
    | 'audio';
  target: SceneShotVideoTakeTarget;
  subjectKind?: ShotVideoTakeInputSubjectKind;
  subjectId?: string;
  label?: string;
  required: boolean;
  reason: string;
}): MediaGenerationDependencySlot {
  return {
    dependencyId: shotVideoInputDependencyId(input),
    dependencyKind: shotInputDependencyKind(input),
    label: input.label ?? shotInputDependencyLabel(input.kind),
    dependencyTarget: input.target,
    selector: {
      kind: 'shot-video-input',
      inputKind: input.kind as ShotVideoTakeInputKind,
      takeId: input.target.takeId,
      shotIds: input.target.shotIds,
      ...(input.subjectKind ? { subjectKind: input.subjectKind } : {}),
      ...(input.subjectId ? { subjectId: input.subjectId } : {}),
    },
    required: input.required,
    reason: input.reason,
  };
}

function shotInputDependencyKind(input: {
  kind:
    | 'first-frame'
    | 'last-frame'
    | 'reference-image'
    | 'multi-shot-storyboard-sheet'
    | 'audio';
  subjectKind?: ShotVideoTakeInputSubjectKind;
}): MediaGenerationDependencySlot['dependencyKind'] {
  if (input.kind === 'audio' && input.subjectKind === 'scene-dialogue') {
    return 'reference-audio';
  }
  if (input.kind === 'audio') {
    return 'manual-attachment';
  }
  return input.kind;
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
  if (kind === 'audio') {
    return 'Dialogue audio';
  }
  return 'Reference image';
}
