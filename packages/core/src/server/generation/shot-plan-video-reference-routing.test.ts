import { describe, expect, it } from 'vitest';
import type { GenerationModelDescriptor } from '../../client/generation.js';
import { shotPlanVideoProviderFieldForReference } from './shot-plan-video-reference-routing.js';

describe('Shot Plan video reference routing', () => {
  it('routes reference media through the selected model semantic fields', () => {
    const model = h3ReferenceModel();

    expect(shotPlanVideoProviderFieldForReference({
      inputMode: 'reference',
      mediaKind: 'image',
      slotId: 'video-storyboard',
      model,
    })).toBe('reference_image_urls');
    expect(shotPlanVideoProviderFieldForReference({
      inputMode: 'reference',
      mediaKind: 'video',
      slotId: 'motion-reference',
      model,
    })).toBe('reference_video_urls');
    expect(shotPlanVideoProviderFieldForReference({
      inputMode: 'reference',
      mediaKind: 'audio',
      slotId: 'audio-reference',
      model,
    })).toBe('reference_audio_urls');
  });
});

function h3ReferenceModel(): GenerationModelDescriptor {
  return {
    provider: 'fal-ai',
    model: 'minimax/h3/reference-to-video',
    label: 'MiniMax H3 Reference To Video',
    mediaKind: 'video',
    fields: [
      mediaField('reference_image_urls', 'reference-image', 'image'),
      mediaField('reference_video_urls', 'source-video', 'video'),
      mediaField('reference_audio_urls', 'audio', 'audio'),
    ],
  };
}

function mediaField(
  name: string,
  role: 'reference-image' | 'source-video' | 'audio',
  mediaKind: 'image' | 'video' | 'audio',
): GenerationModelDescriptor['fields'][number] {
  return {
    name,
    label: name,
    kind: 'array',
    semantic: { kind: 'media', role },
    required: false,
    media: {
      acceptedKinds: [mediaKind],
      cardinality: 'many',
      minimum: 0,
      maximum: 3,
    },
  };
}
