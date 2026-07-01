import { describe, expect, it } from 'vitest';
import {
  SHOT_FIRST_FRAME_GENERATION_PURPOSE,
  type ShotVideoTakeInputGenerationSpec,
} from '../../../client/index.js';
import {
  normalizeInputSpec,
} from './input-specs.js';

describe('shot video take input specs', () => {
  it('rejects shot input specs without referenceMode', () => {
    const spec = { ...validInputSpec() } as Partial<ShotVideoTakeInputGenerationSpec>;
    delete spec.referenceMode;

    expect(() =>
      normalizeInputSpec(spec as ShotVideoTakeInputGenerationSpec)
    ).toThrow(
      expect.objectContaining({
        code: 'CORE_SHOT_VIDEO_INPUT_REFERENCE_MODE_REQUIRED',
      })
    );
  });

  it('rejects unsupported shot input reference modes', () => {
    expect(() =>
      normalizeInputSpec({
        ...validInputSpec(),
        referenceMode: 'scene-storyboard' as ShotVideoTakeInputGenerationSpec['referenceMode'],
      })
    ).toThrow(
      expect.objectContaining({
        code: 'CORE_SHOT_VIDEO_INPUT_REFERENCE_MODE_UNSUPPORTED',
      })
    );
  });
});

function validInputSpec(): ShotVideoTakeInputGenerationSpec {
  return {
    purpose: SHOT_FIRST_FRAME_GENERATION_PURPOSE,
    target: {
      kind: 'sceneShotVideoTake',
      id: 'scene_001:take_001',
      sceneId: 'scene_001',
      takeId: 'take_001',
      shotIds: ['shot_001'],
    },
    dependencyKind: 'first-frame',
    outputInputKind: 'first-frame',
    modelChoice: 'fal-ai/openai/gpt-image-2',
    referenceMode: 'movie-lookbook',
    prompt: 'Create the first frame.',
    parameterValues: {},
  };
}
