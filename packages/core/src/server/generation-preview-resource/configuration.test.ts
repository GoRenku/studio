import { describe, expect, it } from 'vitest';
import type { GenerationPreview } from '../../client/generation.js';
import { projectGenerationPreviewAuthoring } from './configuration.js';

describe('generation preview authoring projection', () => {
  it('projects selectable models and configurable non-media inputs', () => {
    const authoring = projectGenerationPreviewAuthoring(previewFixture());

    expect(authoring.models).toEqual([
      {
        provider: 'fal-ai',
        modelId: 'nano-banana-2',
        label: 'Nano Banana 2',
        controls: [
          {
            controlId: 'num_images',
            kind: 'number',
            label: 'Number of Images',
            value: 2,
            required: false,
            authored: true,
            recommended: false,
            min: 1,
            max: 4,
          },
          {
            controlId: 'aspect_ratio',
            kind: 'select',
            label: 'Aspect Ratio',
            value: '16:9',
            required: false,
            authored: false,
            recommended: true,
            options: [
              { label: '1:1', value: '1:1' },
              { label: '16:9', value: '16:9' },
            ],
          },
          {
            controlId: 'enable_web_search',
            kind: 'toggle',
            label: 'Enable Web Search',
            value: false,
            required: false,
            authored: false,
            recommended: false,
          },
          {
            controlId: 'seed',
            kind: 'number',
            label: 'Seed',
            value: null,
            required: false,
            authored: false,
            recommended: false,
          },
        ],
      },
    ]);
  });
});

function previewFixture(): GenerationPreview {
  return {
    spec: {
      purpose: 'cast.character-sheet',
      target: { kind: 'castMember', id: 'cast_test' },
      model: { provider: 'fal-ai', model: 'nano-banana-2' },
      values: {
        prompt: 'Create a character sheet.',
        num_images: 2,
      },
      references: [],
    },
    settings: {
      fixed: [],
      recommended: [{ kind: 'aspect-ratio', value: '16:9' }],
    },
    models: [
      {
        provider: 'fal-ai',
        model: 'nano-banana-2',
        label: 'Nano Banana 2',
        mediaKind: 'image',
        fields: [
          {
            name: 'prompt',
            label: 'Prompt',
            kind: 'string',
            required: true,
            semantic: { kind: 'authored-text', role: 'prompt' },
          },
          {
            name: 'image_urls',
            label: 'Image URLs',
            kind: 'array',
            required: false,
            semantic: { kind: 'media', role: 'reference-image' },
            media: {
              acceptedKinds: ['image'],
              cardinality: 'many',
              minimum: 0,
              maximum: null,
            },
          },
          {
            name: 'num_images',
            label: 'Number of Images',
            kind: 'integer',
            required: false,
            defaultValue: 1,
            minimum: 1,
            maximum: 4,
          },
          {
            name: 'aspect_ratio',
            label: 'Aspect Ratio',
            kind: 'enum',
            required: false,
            productSettingKind: 'aspect-ratio',
            productSettingValues: {
              '1:1': '1:1',
              '16:9': '16:9',
            },
            defaultValue: '1:1',
            allowedValues: ['1:1', '16:9'],
          },
          {
            name: 'enable_web_search',
            label: 'Enable Web Search',
            kind: 'boolean',
            required: false,
            defaultValue: false,
          },
          {
            name: 'seed',
            label: 'Seed',
            kind: 'integer',
            required: false,
          },
        ],
      },
    ],
    referenceGuide: { sections: [], notices: [] },
    references: [],
    diagnostics: [],
  };
}
