import {
  type MediaGenerationPurpose,
  type MediaGenerationRequestTarget,
} from '@gorenku/studio-core/server';
import { StructuredError } from '@gorenku/studio-diagnostics';
import {
  parseCastTarget,
  parseLocationTarget,
  parseLookbookTarget,
  parseSceneTarget,
  parseShots,
} from './studio-target-parsing.js';
import { requiredFlag } from './structured-command.js';

export const SUPPORTED_GENERATION_PURPOSES = [
  'lookbook.image',
  'lookbook.sheet',
  'cast.character-sheet',
  'cast.profile',
  'location.environment-sheet',
  'scene.storyboard-sheet',
  'shot.first-frame',
  'shot.last-frame',
  'shot.reference-sheet',
  'shot.multi-shot-storyboard-sheet',
  'shot.video-take',
] as const satisfies readonly MediaGenerationPurpose[];

export function parseGenerationPurpose(
  purpose: string
): MediaGenerationPurpose {
  if (isSupportedGenerationPurpose(purpose)) {
    return purpose;
  }
  throw unsupportedGenerationPurpose(purpose);
}

export function parseGenerationTarget(input: {
  purpose: string;
  target: string;
  shotListId?: string;
  shots?: string;
  productionGroupId?: string;
}): MediaGenerationRequestTarget {
  const purpose = parseGenerationPurpose(input.purpose);
  if (purpose === 'lookbook.image' || purpose === 'lookbook.sheet') {
    return {
      kind: 'lookbook',
      id: parseLookbookTarget(input.target, 'Lookbook generation'),
    };
  }
  if (purpose === 'cast.character-sheet' || purpose === 'cast.profile') {
    return {
      kind: 'castMember',
      id: parseCastTarget(input.target, 'Cast image generation'),
    };
  }
  if (purpose === 'location.environment-sheet') {
    return {
      kind: 'location',
      id: parseLocationTarget(input.target, 'Location image generation'),
    };
  }
  if (purpose === 'scene.storyboard-sheet') {
    return {
      kind: 'scene',
      id: parseSceneTarget(input.target, 'Scene storyboard sheet generation'),
    };
  }
  return parseSceneShotGroupTarget(input);
}

export function assertShotVideoTakePurpose(purpose: string): void {
  if (purpose !== 'shot.video-take') {
    throw unsupportedGenerationPurpose(purpose);
  }
}

export function unsupportedGenerationPurpose(purpose: string): StructuredError {
  return new StructuredError({
    code: 'CLI024',
    message: `Unsupported generation purpose: ${purpose}.`,
    suggestion:
      'Use --purpose lookbook.image, --purpose lookbook.sheet, --purpose cast.character-sheet, --purpose cast.profile, --purpose location.environment-sheet, --purpose scene.storyboard-sheet, --purpose shot.first-frame, --purpose shot.last-frame, --purpose shot.reference-sheet, --purpose shot.multi-shot-storyboard-sheet, or --purpose shot.video-take.',
  });
}

function parseSceneShotGroupTarget(input: {
  target: string;
  shotListId?: string;
  shots?: string;
  productionGroupId?: string;
}): MediaGenerationRequestTarget {
  const sceneId = parseSceneTarget(input.target, 'Shot media generation');
  const shotListId = requiredFlag(input.shotListId, '--shot-list');
  const shotIds = parseShots(requiredFlag(input.shots, '--shots'));
  return {
    kind: 'sceneShotGroup',
    ...(input.productionGroupId
      ? { id: `${sceneId}:${shotListId}:${input.productionGroupId}` }
      : {}),
    sceneId,
    shotListId,
    ...(input.productionGroupId
      ? { productionGroupId: input.productionGroupId }
      : {}),
    shotIds,
  };
}

function isSupportedGenerationPurpose(
  purpose: string
): purpose is MediaGenerationPurpose {
  return SUPPORTED_GENERATION_PURPOSES.some(
    (supportedPurpose) => supportedPurpose === purpose
  );
}
