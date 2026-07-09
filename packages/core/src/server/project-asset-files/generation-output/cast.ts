import {
  CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
  CAST_PROFILE_GENERATION_PURPOSE,
  CAST_VOICE_SAMPLE_GENERATION_PURPOSE,
} from '../../../client/index.js';
import type { GenerationOutputResolverInput, GenerationOutputAllocation } from './types.js';
import { requiredSpecString, sourceProjectRelativePathForMediaKind, specObject, targetId } from './types.js';

type CastPurpose =
  | typeof CAST_CHARACTER_SHEET_GENERATION_PURPOSE
  | typeof CAST_PROFILE_GENERATION_PURPOSE
  | typeof CAST_VOICE_SAMPLE_GENERATION_PURPOSE;

export async function resolveCastGenerationOutput(
  input: GenerationOutputResolverInput<CastPurpose>
): Promise<GenerationOutputAllocation> {
  const spec = specObject(input.specRecord);
  if (input.specRecord.purpose === CAST_CHARACTER_SHEET_GENERATION_PURPOSE) {
    return {
      kind: 'durableAsset',
      destination: { kind: 'cast.characterSheet', castMemberId: targetId(spec) },
      sourceProjectRelativePath: sourceProjectRelativePathForMediaKind('image'),
      mediaKind: 'image',
    };
  }
  if (input.specRecord.purpose === CAST_PROFILE_GENERATION_PURPOSE) {
    return {
      kind: 'durableAsset',
      destination: { kind: 'cast.profile', castMemberId: targetId(spec) },
      sourceProjectRelativePath: sourceProjectRelativePathForMediaKind('image'),
      mediaKind: 'image',
    };
  }
  return {
    kind: 'durableAsset',
    destination: {
      kind: 'cast.voiceSample',
      castMemberId: targetId(spec),
      castVoiceId: targetId(spec),
      referenceName: requiredSpecString(spec, 'referenceName'),
    },
    sourceProjectRelativePath: sourceProjectRelativePathForMediaKind('audio'),
    mediaKind: 'audio',
    outputFormatHint: extensionForAudioOutputFormat(
      typeof spec.outputFormat === 'string' ? spec.outputFormat : undefined
    ),
  };
}

function extensionForAudioOutputFormat(outputFormat: string | undefined): string {
  if (outputFormat?.startsWith('pcm_')) {
    return '.wav';
  }
  if (outputFormat?.startsWith('mp3_')) {
    return '.mp3';
  }
  return '.mp3';
}
