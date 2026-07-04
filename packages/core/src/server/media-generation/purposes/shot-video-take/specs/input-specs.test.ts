import { describe, expect, it } from 'vitest';
import {
  SHOT_FIRST_FRAME_GENERATION_PURPOSE,
  SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE,
  type ShotVideoTakeInputGenerationSpec,
  type ShotVideoTakeProductionContext,
} from '../../../../../client/index.js';
import {
  normalizeInputSpec,
  validateInputSpecAgainstContext,
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

  it('accepts an opaque video prompt sheet with arbitrary prompt text', () => {
    expect(() =>
      validateInputSpecAgainstContext(
        {
          ...validVideoPromptSheetSpec(),
          prompt:
            'Create one full-canvas movement map with no panels, no labels, and no shot captions.',
        },
        productionContext(['shot_001'])
      )
    ).not.toThrow();
  });

  it.each([
    ['cinematic-realistic', 'motion-annotation'],
    ['handdrawn-storyboard', 'motion-annotation'],
    ['cinematic-realistic', 'none'],
  ] as const)(
    'accepts %s visual style with %s notation mode',
    (promptSheetVisualStyleId, promptSheetNotationModeId) => {
      expect(() =>
        validateInputSpecAgainstContext(
          {
            ...validVideoPromptSheetSpec(),
            promptSheetVisualStyleId,
            promptSheetNotationModeId,
          },
          productionContext(['shot_001'])
        )
      ).not.toThrow();
    }
  );

  it('rejects video prompt sheets without prompt-sheet metadata', () => {
    const spec = {
      ...validVideoPromptSheetSpec(),
      promptSheetVisualStyleId: undefined,
      promptSheetNotationModeId: undefined,
    };

    expect(() =>
      validateInputSpecAgainstContext(
        spec,
        productionContext(['shot_001'])
      )
    ).toThrow(
      expect.objectContaining({
        code: 'CORE_VIDEO_PROMPT_SHEET_METADATA_INVALID',
      })
    );
  });

  it('rejects first-frame specs that include prompt-sheet metadata', () => {
    expect(() =>
      validateInputSpecAgainstContext(
        {
          ...validInputSpec(),
          promptSheetVisualStyleId: 'cinematic-realistic',
          promptSheetNotationModeId: 'none',
        },
        productionContext(['shot_001'])
      )
    ).toThrow(
      expect.objectContaining({
        code: 'CORE_VIDEO_PROMPT_SHEET_METADATA_FORBIDDEN',
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

function validVideoPromptSheetSpec(): ShotVideoTakeInputGenerationSpec {
  return {
    ...validInputSpec(),
    purpose: SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE,
    dependencyKind: 'video-prompt-sheet',
    outputInputKind: 'video-prompt-sheet',
    referenceMode: 'storyboard-lookbook',
    prompt: 'Create a motion-control prompt sheet.',
    promptSheetVisualStyleId: 'handdrawn-storyboard',
    promptSheetNotationModeId: 'motion-annotation',
  };
}

function productionContext(shotIds: string[]): ShotVideoTakeProductionContext {
  return {
    target: {
      kind: 'sceneShotVideoTake',
      id: 'scene_001:take_001',
      sceneId: 'scene_001',
      takeId: 'take_001',
      shotIds,
    },
  } as ShotVideoTakeProductionContext;
}
