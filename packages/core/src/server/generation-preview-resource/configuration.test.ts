import { describe, expect, it } from 'vitest';
import type { GenerationPreview } from '../../client/generation.js';
import {
  projectGenerationPreviewAuthoring,
  projectGenerationPreviewConfiguration,
} from './configuration.js';

describe('generation preview authoring projection', () => {
  it('projects model families and only catalog-declared controls', async () => {
    const preview = previewFixture();
    const authoring = await projectGenerationPreviewAuthoring({
      preview,
      model: preview.models![0],
    });

    expect(authoring.selectedModelFamilyId).toBe('nano-banana-2');
    expect(authoring.modelFamilies).toEqual([
      { familyId: 'nano-banana-2', label: 'Nano Banana 2' },
    ]);
    expect(authoring.controls).toEqual([
          {
            controlId: 'aspect_ratio',
            kind: 'select',
            label: 'Aspect ratio',
            value: '16:9',
            required: false,
            authored: false,
            recommended: true,
            options: [
              { label: 'Square · 1:1', value: '1:1' },
              { label: 'Landscape · 16:9', value: '16:9' },
            ],
          },
          {
            controlId: 'resolution',
            kind: 'select',
            label: 'Resolution',
            value: '1K',
            required: false,
            authored: false,
            recommended: false,
            options: [
              { label: '1K', value: '1K' },
              { label: '2K', value: '2K' },
              { label: '4K', value: '4K' },
            ],
          },
    ]);
  });

  it('presents saved external properties with readable labels and dimensions', () => {
    const preview = previewFixture();
    preview.spec = {
      ...preview.spec,
      executionKind: 'agent-external',
      model: { provider: 'codex', model: 'gpt-image-2' },
      values: {
        prompt: 'Create a location sheet.',
        aspect_ratio: '16:9',
        resolution: { width: 1672, height: 941 },
        output_format: 'png',
      },
    };

    const configuration = projectGenerationPreviewConfiguration({
      preview,
      authoring: { selectedModelFamilyId: '', modelFamilies: [], controls: [] },
    });

    expect(configuration.sections[1]?.rows).toEqual([
      expect.objectContaining({ label: 'Aspect ratio', value: '16:9' }),
      expect.objectContaining({
        label: 'Resolution',
        value: { kind: 'dimensions', width: 1672, height: 941 },
      }),
      expect.objectContaining({ label: 'Output format', value: 'png' }),
    ]);
  });
});

function previewFixture(): GenerationPreview {
  return {
    spec: {
      executionKind: 'renku-managed',
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
          {
            name: 'resolution',
            label: 'Resolution',
            kind: 'enum',
            required: false,
            defaultValue: '1K',
            allowedValues: ['1K', '2K', '4K'],
          },
        ],
      },
    ],
    referenceGuide: { sections: [], notices: [] },
    references: [],
    diagnostics: [],
  };
}
