import {
  isGenerationPurpose,
  readGenerationPurpose,
  type GenerationPurpose,
  type GenerationTarget,
} from '@gorenku/studio-core/server';
import { StructuredError } from '@gorenku/studio-diagnostics';
import {
  parseCastTarget,
  parseLocationTarget,
  parseLookbookTarget,
  parseSceneDialogueTarget,
  parseSceneTarget,
} from './studio-target-parsing.js';

export function parseGenerationPurpose(purpose: string): GenerationPurpose {
  if (isGenerationPurpose(purpose)) {
    return purpose;
  }
  throw new StructuredError({
    code: 'CLI024',
    message: `Unsupported generation purpose: ${purpose}.`,
    suggestion: 'Run generation context with one of the purposes reported by the current Core generation contract.',
  });
}

export function parseGenerationTarget(input: {
  purpose: GenerationPurpose;
  target: string;
}): GenerationTarget {
  return targetParsers[readGenerationPurpose(input.purpose).targetKind](input.target, input.purpose);
}

const targetParsers: Record<GenerationTarget['kind'], (value: string, purpose: GenerationPurpose) => GenerationTarget> = {
  project: (value, purpose) => value === 'project' ? { kind: 'project', id: 'project' } : invalidTarget({ purpose, target: value }, 'project'),
  asset: (value, purpose) => ({ kind: 'asset', id: parsePrefixedTarget(value, 'asset', purpose) }),
  lookbook: (value) => ({ kind: 'lookbook', id: parseLookbookTarget(value, 'Lookbook generation') }),
  castMember: (value) => ({ kind: 'castMember', id: parseCastTarget(value, 'Cast generation') }),
  location: (value) => ({ kind: 'location', id: parseLocationTarget(value, 'Location generation') }),
  scene: (value) => ({ kind: 'scene', id: parseSceneTarget(value, 'Scene generation') }),
  sceneDialogue: (value) => ({ kind: 'sceneDialogue', id: parseSceneDialogueTarget(value, 'Dialogue generation').dialogueId }),
  sceneShotVideoTake: (value, purpose) => ({ kind: 'sceneShotVideoTake', id: parsePrefixedTarget(value, 'take', purpose) }),
};

function parsePrefixedTarget(value: string, prefix: string, purpose: GenerationPurpose): string {
  const [kind, id, extra] = value.split(':');
  if (kind !== prefix || !id || extra !== undefined) {
    invalidTarget({ purpose, target: value }, `${prefix}:<id>`);
  }
  return id!;
}

function invalidTarget(input: { purpose: GenerationPurpose; target: string }, expected: string): never {
  throw new StructuredError({
    code: 'CLI147',
    message: `${input.purpose} target must use ${expected}. Received: ${input.target}.`,
    suggestion: `Use --target ${expected}.`,
  });
}
