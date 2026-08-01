import { describe, expect, it } from 'vitest';
import { listGenerationModels } from './purposes.js';
import {
  resolveStudioVideoRoute,
  routeKindForInputMode,
  shotPlanVideoDurationCapability,
} from './shot-plan-video-model-authoring.js';
import { validatedShotPlanVideoParameterValues } from './shot-plan-video-configurable-values.js';

describe('Shot Plan video model authoring', () => {
  it('resolves every accepted family and input mode to the exact catalog route', async () => {
    const availableModels = await listGenerationModels({
      outputMediaKind: 'video',
    });
    const families = [
      'seedance-2.0',
      'seedance-2.0-mini',
      'seedance-2.0-fast',
      'minimax-h3',
    ];
    const modes = [
      'text-only',
      'first-frame',
      'first-last-frame',
      'reference',
    ] as const;

    for (const modelFamilyId of families) {
      for (const inputMode of modes) {
        const resolved = await resolveStudioVideoRoute({
          modelFamilyId,
          inputMode,
          availableModels,
        });
        expect(resolved.route.model).toMatch(
          new RegExp(`${routeKindForInputMode(inputMode)}-to-video$`),
        );
        expect(resolved.model.model).toBe(resolved.route.model);
        expect(shotPlanVideoDurationCapability(resolved.model)).toMatch(
          /^Up to \d+ seconds$/,
        );
      }
    }
  });

  it('accepts only exact catalog-declared configurable values', async () => {
    const availableModels = await listGenerationModels({
      outputMediaKind: 'video',
    });
    const resolved = await resolveStudioVideoRoute({
      modelFamilyId: 'seedance-2.0',
      inputMode: 'reference',
      availableModels,
    });

    expect(validatedShotPlanVideoParameterValues({
      route: resolved.route,
      model: resolved.model,
      parameterValues: {
        duration: '6',
        aspect_ratio: '16:9',
        resolution: '480p',
        generate_audio: true,
      },
    })).toEqual({
      duration: '6',
      aspect_ratio: '16:9',
      resolution: '480p',
      generate_audio: true,
    });
    expect(() => validatedShotPlanVideoParameterValues({
      route: resolved.route,
      model: resolved.model,
      parameterValues: { seed: 42 },
    })).toThrow(expect.objectContaining({
      code: 'CORE_SHOT_PLAN_VIDEO_PARAMETER_INVALID',
    }));
  });
});
