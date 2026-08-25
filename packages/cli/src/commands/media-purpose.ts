import {
  isMediaPurpose,
  MEDIA_PURPOSE_TARGET_KINDS,
  type MediaPurpose,
  type MediaTarget,
} from '@gorenku/studio-core/client';
import { StructuredError } from '@gorenku/studio-diagnostics';
import {
  parseCastTarget,
  parseLocationTarget,
  parsePropTarget,
  parseLookbookTarget,
  parseSceneDialogueTarget,
  parseSceneTarget,
} from './studio-target-parsing.js';

export function parseGenerationPurpose(purpose: string): MediaPurpose {
  if (isMediaPurpose(purpose)) {
    return purpose;
  }
  throw new StructuredError({
    code: 'CLI024',
    message: `Unsupported media purpose: ${purpose}.`,
    suggestion: 'Use one of the current focused media attachment purposes.',
  });
}

export function parseGenerationTarget(input: {
  purpose: MediaPurpose;
  target: string;
}): MediaTarget {
  const targetKind = MEDIA_PURPOSE_TARGET_KINDS[input.purpose];
  const parser = targetParsers[targetKind];
  return parser(input.target, input.purpose);
}

const targetParsers: Record<
  MediaTarget['kind'],
  (value: string, purpose: MediaPurpose) => MediaTarget
> = {
  project: (value, purpose) => value === 'project'
    ? { kind: 'project', id: 'project' }
    : invalidTarget({ purpose, target: value }, 'project'),
  asset: (value, purpose) => ({ kind: 'asset', id: parsePrefixedTarget(value, 'asset', purpose) }),
  lookbook: (value) => ({ kind: 'lookbook', id: parseLookbookTarget(value, 'Media attachment') }),
  castMember: (value) => ({ kind: 'castMember', id: parseCastTarget(value, 'Media attachment') }),
  location: (value) => ({ kind: 'location', id: parseLocationTarget(value, 'Media attachment') }),
  prop: (value) => ({ kind: 'prop', id: parsePropTarget(value, 'Media attachment') }),
  scene: (value) => ({ kind: 'scene', id: parseSceneTarget(value, 'Media attachment') }),
  shot: (value, purpose) => ({ kind: 'shot', id: parsePrefixedTarget(value, 'shot', purpose) }),
  shotPlan: (value, purpose) => ({ kind: 'shotPlan', id: parsePrefixedTarget(value, 'shot-plan', purpose) }),
  sceneDialogue: (value) => ({
    kind: 'sceneDialogue',
    id: parseSceneDialogueTarget(value, 'Dialogue media attachment').dialogueId,
  }),
};

function parsePrefixedTarget(value: string, prefix: string, purpose: MediaPurpose): string {
  const [kind, id, extra] = value.split(':');
  if (kind !== prefix || !id || extra !== undefined) {
    invalidTarget({ purpose, target: value }, `${prefix}:<id>`);
  }
  return id!;
}

function invalidTarget(
  input: { purpose: MediaPurpose; target: string },
  expected: string,
): never {
  throw new StructuredError({
    code: 'CLI147',
    message: `${input.purpose} target must use ${expected}. Received: ${input.target}.`,
    suggestion: `Use --target ${expected}.`,
  });
}
