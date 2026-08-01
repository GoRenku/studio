import { describe, expect, it } from 'vitest';
import { listGenerationModels } from './catalog/model-discovery.js';
import {
  listStudioVideoModelFamilies,
  readStudioVideoModelFamily,
  readStudioVideoModelRouteProfile,
} from './studio-video-model-catalog.js';

describe('Studio video model catalog', () => {
  it('validates the accepted video families and their exact routes', async () => {
    const families = await listStudioVideoModelFamilies();

    expect(families.map((family) => family.id)).toEqual([
      'seedance-2.0',
      'seedance-2.0-mini',
      'seedance-2.0-fast',
      'minimax-h3',
    ]);
    expect(families.flatMap((family) => Object.values(family.routes))).toHaveLength(12);
    expect(await readStudioVideoModelFamily('seedance-2.0')).toMatchObject({
      label: 'Seedance 2.0',
      routes: {
        text: { model: 'bytedance/seedance-2.0/text-to-video' },
        image: { model: 'bytedance/seedance-2.0/image-to-video' },
        reference: { model: 'bytedance/seedance-2.0/reference-to-video' },
      },
    });
    expect(await readStudioVideoModelFamily('minimax-h3')).toMatchObject({
      label: 'MiniMax H3',
      routes: {
        text: { model: 'minimax/h3/text-to-video' },
        image: { model: 'minimax/h3/image-to-video' },
        reference: { model: 'minimax/h3/reference-to-video' },
      },
    });
  });

  it('exposes only H3 settings that vary on each exact route', async () => {
    const imageRoute = await readStudioVideoModelRouteProfile({
      provider: 'fal-ai',
      model: 'minimax/h3/image-to-video',
    });
    const referenceRoute = await readStudioVideoModelRouteProfile({
      provider: 'fal-ai',
      model: 'minimax/h3/reference-to-video',
    });

    expect(imageRoute?.userConfigurableParameters.map(
      (parameter) => parameter.field,
    )).toEqual(['duration']);
    expect(referenceRoute?.userConfigurableParameters.map(
      (parameter) => parameter.field,
    )).toEqual(['duration', 'aspect_ratio']);
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
