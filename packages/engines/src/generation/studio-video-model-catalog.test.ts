import { describe, expect, it } from 'vitest';
import { listGenerationModels } from './catalog/model-discovery.js';
import {
  listStudioVideoModelFamilies,
  readStudioVideoModelFamily,
  readStudioVideoModelRouteProfile,
} from './studio-video-model-catalog.js';

describe('Studio video model catalog', () => {
  it('validates the three accepted families and nine exact Seedance routes', async () => {
    const families = await listStudioVideoModelFamilies();

    expect(families.map((family) => family.id)).toEqual([
      'seedance-2.0',
      'seedance-2.0-mini',
      'seedance-2.0-fast',
    ]);
    expect(families.flatMap((family) => Object.values(family.routes))).toHaveLength(9);
    expect(await readStudioVideoModelFamily('seedance-2.0')).toMatchObject({
      label: 'Seedance 2.0',
      routes: {
        text: { model: 'bytedance/seedance-2.0/text-to-video' },
        image: { model: 'bytedance/seedance-2.0/image-to-video' },
        reference: { model: 'bytedance/seedance-2.0/reference-to-video' },
      },
    });
  });

  it('exposes only the accepted controls with the 480p product initial value', async () => {
    const route = await readStudioVideoModelRouteProfile({
      provider: 'fal-ai',
      model: 'bytedance/seedance-2.0/image-to-video',
    });

    expect(route?.userConfigurableParameters.map((parameter) => parameter.field)).toEqual([
      'duration',
      'aspect_ratio',
      'resolution',
      'generate_audio',
    ]);
    expect(route?.userConfigurableParameters.find(
      (parameter) => parameter.field === 'resolution',
    )).toMatchObject({ initialValue: '480p' });
  });

  it('keeps technically implemented inactive video models in generic discovery', async () => {
    const models = await listGenerationModels({ mediaKind: 'video' });

    expect(models.some((model) => model.model.startsWith('kling-video/'))).toBe(true);
    expect(models.some((model) => model.model.startsWith('veo3.1'))).toBe(true);
  });
});
