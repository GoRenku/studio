import type {
  MediaGenerationDependencyKind,
  SceneShotMediaGenerationTarget,
  ShotVideoTakeInputKind,
  ShotVideoTakeInputSubjectKind,
} from '../../client/index.js';

export interface ShotVideoInputDependencyIdentifierInput {
  kind: ShotVideoTakeInputKind;
  target?: SceneShotMediaGenerationTarget;
  subjectKind?: ShotVideoTakeInputSubjectKind;
  subjectId?: string;
}

export interface ParsedShotVideoInputDependencyIdentifier {
  kind: ShotVideoTakeInputKind;
  subjectKind?: ShotVideoTakeInputSubjectKind;
  subjectId?: string;
}

export type ShotVideoInputDependencyIdentifierParseResult =
  | {
      ok: true;
      value: ParsedShotVideoInputDependencyIdentifier;
    }
  | {
      ok: false;
      reason: 'empty' | 'unsupported-kind' | 'malformed';
    };

const shotVideoInputKinds = new Set<ShotVideoTakeInputKind>([
  'first-frame',
  'last-frame',
  'reference-image',
  'character-sheet',
  'location-sheet',
  'lookbook-sheet',
  'multi-shot-storyboard-sheet',
  'source-video',
  'audio',
]);

const shotVideoInputSubjectKinds = new Set<ShotVideoTakeInputSubjectKind>([
  'cast-member',
  'location',
  'lookbook',
  'shot',
  'production-group',
  'asset',
  'scene-dialogue',
]);

export function castCharacterSheetDependencyId(castMemberId: string): string {
  return `cast-character-sheet:${castMemberId}`;
}

export function locationEnvironmentSheetDependencyId(locationId: string): string {
  return `location-environment-sheet:${locationId}`;
}

export function lookbookSheetDependencyId(lookbookId: string): string {
  return `lookbook-sheet:${lookbookId}`;
}

export function sceneDialogueAudioDependencyId(dialogueId: string): string {
  return shotVideoInputDependencyId({
    kind: 'audio',
    subjectKind: 'scene-dialogue',
    subjectId: dialogueId,
  });
}

export function shotVideoInputDependencyId(
  input: ShotVideoInputDependencyIdentifierInput
): string {
  if (
    input.kind === 'character-sheet' &&
    input.subjectKind === 'cast-member' &&
    input.subjectId
  ) {
    return castCharacterSheetDependencyId(input.subjectId);
  }
  if (
    input.kind === 'location-sheet' &&
    input.subjectKind === 'location' &&
    input.subjectId
  ) {
    return locationEnvironmentSheetDependencyId(input.subjectId);
  }
  if (
    input.kind === 'lookbook-sheet' &&
    input.subjectKind === 'lookbook' &&
    input.subjectId
  ) {
    return lookbookSheetDependencyId(input.subjectId);
  }
  const subjectKind = input.subjectKind ?? 'production-group';
  const subjectId =
    input.subjectId ?? input.target?.productionGroupId ?? input.target?.id ?? '';
  return [input.kind, subjectKind, subjectId].join(':');
}

export function parseShotVideoInputDependencyId(
  dependencyId: string | undefined
): ShotVideoInputDependencyIdentifierParseResult {
  if (!dependencyId) {
    return { ok: false, reason: 'empty' };
  }

  const [dependencyKind, dependencySubjectId, ...extraParts] = dependencyId.split(':');
  if (extraParts.length > 1) {
    return { ok: false, reason: 'malformed' };
  }

  if (dependencyKind === 'cast-character-sheet' && dependencySubjectId) {
    return {
      ok: true,
      value: {
        kind: 'character-sheet',
        subjectKind: 'cast-member',
        subjectId: dependencySubjectId,
      },
    };
  }
  if (dependencyKind === 'location-environment-sheet' && dependencySubjectId) {
    return {
      ok: true,
      value: {
        kind: 'location-sheet',
        subjectKind: 'location',
        subjectId: dependencySubjectId,
      },
    };
  }
  if (dependencyKind === 'lookbook-sheet' && dependencySubjectId) {
    return {
      ok: true,
      value: {
        kind: 'lookbook-sheet',
        subjectKind: 'lookbook',
        subjectId: dependencySubjectId,
      },
    };
  }

  if (!isShotVideoInputKind(dependencyKind)) {
    return { ok: false, reason: 'unsupported-kind' };
  }
  const subjectKind = isShotVideoInputSubjectKind(dependencySubjectId)
    ? dependencySubjectId
    : undefined;
  const subjectId = extraParts[0];
  return {
    ok: true,
    value: {
      kind: dependencyKind,
      ...(subjectKind ? { subjectKind } : {}),
      ...(subjectId ? { subjectId } : {}),
    },
  };
}

export function dependencyKindForShotVideoInput(
  kind: ShotVideoTakeInputKind,
  subjectKind?: ShotVideoTakeInputSubjectKind
): MediaGenerationDependencyKind {
  if (kind === 'character-sheet' && subjectKind === 'cast-member') {
    return 'cast-character-sheet';
  }
  if (kind === 'location-sheet' && subjectKind === 'location') {
    return 'location-environment-sheet';
  }
  if (kind === 'lookbook-sheet' && subjectKind === 'lookbook') {
    return 'lookbook-sheet';
  }
  if (
    kind === 'first-frame' ||
    kind === 'last-frame' ||
    kind === 'reference-image' ||
    kind === 'multi-shot-storyboard-sheet'
  ) {
    return kind;
  }
  if (kind === 'audio' && subjectKind === 'scene-dialogue') {
    return 'reference-audio';
  }
  return 'manual-attachment';
}

function isShotVideoInputKind(value: string | undefined): value is ShotVideoTakeInputKind {
  return Boolean(value && shotVideoInputKinds.has(value as ShotVideoTakeInputKind));
}

function isShotVideoInputSubjectKind(
  value: string | undefined
): value is ShotVideoTakeInputSubjectKind {
  return Boolean(
    value && shotVideoInputSubjectKinds.has(value as ShotVideoTakeInputSubjectKind)
  );
}
