import { describe, expect, it } from 'vitest';
import { SHOT_VIDEO_MODEL_FAMILIES } from './shot-video-model-families.js';
import { validateShotVideoModelFamilies } from './shot-video-route-validation.js';

describe('shot video route catalog validation', () => {
  it('validates every selectable shot video route against provider schemas and pricing', async () => {
    const result = await validateShotVideoModelFamilies();

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(SHOT_VIDEO_MODEL_FAMILIES.map((family) => family.choice)).toEqual([
      'fal-ai/bytedance/seedance-2.0',
      'fal-ai/kling-video/v3/pro',
      'fal-ai/veo3.1',
      'fal-ai/xai/grok-imagine-video-1.5',
      'fal-ai/ltx-3.2',
      'fal-ai/alibaba/happy-horse',
    ]);
  });

  it('keeps route parameters scoped to provider variant fields', () => {
    const klingImageRoute = SHOT_VIDEO_MODEL_FAMILIES
      .find((family) => family.choice === 'fal-ai/kling-video/v3/pro')
      ?.routes.find((route) => route.intent === 'first-frame');
    const veoImageRoute = SHOT_VIDEO_MODEL_FAMILIES
      .find((family) => family.choice === 'fal-ai/veo3.1')
      ?.routes.find((route) => route.intent === 'first-frame');
    const happyHorseImageRoute = SHOT_VIDEO_MODEL_FAMILIES
      .find((family) => family.choice === 'fal-ai/alibaba/happy-horse')
      ?.routes.find((route) => route.intent === 'first-frame');

    expect(klingImageRoute?.parameters.map((parameter) => parameter.id)).not.toContain('aspect_ratio');
    expect(veoImageRoute?.parameters.map((parameter) => parameter.id)).not.toContain('seed');
    expect(happyHorseImageRoute?.parameters.map((parameter) => parameter.id)).not.toContain('aspect_ratio');
  });
});
