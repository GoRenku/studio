import {
  type MediaGenerationPurpose,
  type MediaGenerationRequestTarget,
} from '@gorenku/studio-core/server';
import { StructuredError } from '@gorenku/studio-diagnostics';
import {
  parseCastTarget,
  parseLocationTarget,
  parseLookbookTarget,
  parseSceneDialogueTarget,
  parseSceneTarget,
} from './studio-target-parsing.js';
import { requiredFlag } from './structured-command.js';

export const SUPPORTED_GENERATION_PURPOSES = [
  'lookbook.image',
  'image.create',
  'image.edit',
  'lookbook.sheet',
  'cast.character-sheet',
  'cast.profile',
  'cast.voice-sample',
  'location.environment-sheet',
  'location.hero',
  'scene.storyboard-sheet',
  'scene.dialogue-audio',
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
  shots?: string;
  takeId?: string;
}): MediaGenerationRequestTarget {
  const purpose = parseGenerationPurpose(input.purpose);
  if (isLookbookGenerationPurpose(purpose)) {
    return {
      kind: 'lookbook',
      id: parseLookbookTarget(input.target, 'Lookbook generation'),
    };
  }
  if (isGenericImageGenerationPurpose(purpose)) {
    return parseGenericImageGenerationTarget(purpose, input.target);
  }
  if (isCastGenerationPurpose(purpose)) {
    return {
      kind: 'castMember',
      id: parseCastTarget(input.target, 'Cast image generation'),
    };
  }
  if (purpose === 'location.environment-sheet' || purpose === 'location.hero') {
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
  if (purpose === 'scene.dialogue-audio') {
    return {
      kind: 'sceneDialogue',
      ...parseSceneDialogueTarget(
        input.target,
        'Scene dialogue audio generation'
      ),
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
      'Use --purpose image.create, --purpose image.edit, --purpose lookbook.image, --purpose lookbook.sheet, --purpose cast.character-sheet, --purpose cast.profile, --purpose cast.voice-sample, --purpose location.environment-sheet, --purpose location.hero, --purpose scene.storyboard-sheet, --purpose scene.dialogue-audio, or --purpose shot.video-take.',
  });
}

function isGenericImageGenerationPurpose(
  purpose: MediaGenerationPurpose
): purpose is 'image.create' | 'image.edit' {
  return purpose === 'image.create' || purpose === 'image.edit';
}

function parseGenericImageGenerationTarget(
  purpose: 'image.create' | 'image.edit',
  target: string
): MediaGenerationRequestTarget {
  return purpose === 'image.create'
    ? parseProjectGenerationTarget(target)
    : parseAssetGenerationTarget(target);
}

function parseProjectGenerationTarget(target: string): MediaGenerationRequestTarget {
  if (target !== 'project') {
    throw new StructuredError({
      code: 'CLI148',
      message: `Image create generation target must use project. Received: ${target}.`,
      suggestion: 'Use --target project for --purpose image.create.',
    });
  }
  return { kind: 'project' };
}

function parseAssetGenerationTarget(target: string): MediaGenerationRequestTarget {
  const [kind, id, extra] = target.split(':');
  if (kind !== 'asset' || !id || extra !== undefined) {
    throw new StructuredError({
      code: 'CLI147',
      message: `Image edit generation target must use asset:<asset-id>. Received: ${target}.`,
      suggestion: 'Use --target asset:<asset-id> for --purpose image.edit.',
    });
  }
  return { kind: 'asset', id };
}

function parseSceneShotGroupTarget(input: {
  target: string;
  shots?: string;
  takeId?: string;
}): MediaGenerationRequestTarget {
  const sceneId = parseSceneTarget(input.target, 'Shot media generation');
  const takeId = requiredFlag(input.takeId, '--take');
  return {
    kind: 'sceneShotVideoTake',
    id: takeId,
    sceneId,
    takeId,
  };
}

function isSupportedGenerationPurpose(
  purpose: string
): purpose is MediaGenerationPurpose {
  return SUPPORTED_GENERATION_PURPOSES.some(
    (supportedPurpose) => supportedPurpose === purpose
  );
}

function isLookbookGenerationPurpose(purpose: MediaGenerationPurpose): boolean {
  return purpose === 'lookbook.image' || purpose === 'lookbook.sheet';
}

function isCastGenerationPurpose(purpose: MediaGenerationPurpose): boolean {
  return (
    purpose === 'cast.character-sheet' ||
    purpose === 'cast.profile' ||
    purpose === 'cast.voice-sample'
  );
}
