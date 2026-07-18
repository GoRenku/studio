import { describe, expect, it } from 'vitest';
import type { GenerationPreviewResource } from '@gorenku/studio-core/client';
import {
  buildGenerationPreviewUpdateRequest,
  changeGenerationPreviewReference,
  createGenerationPreviewDraft,
  generationPreviewDraftIsDirty,
  generationPreviewReferenceSelected,
} from './generation-preview-draft';

describe('generation preview draft', () => {
  it('starts clean from authored prompt and reference selections', () => {
    const preview = previewFixture();
    const draft = createGenerationPreviewDraft(preview);

    expect(draft.promptDraft.authoredText).toBe('Original prompt.');
    expect(
      generationPreviewReferenceSelected(
        preview.references.slots[0]!,
        preview.references.slots[0]!.current!,
        draft
      )
    ).toBe(true);
    expect(generationPreviewDraftIsDirty(preview, draft)).toBe(false);
  });

  it('builds one update envelope from prompt and local reference changes', () => {
    const preview = previewFixture();
    const draft = createGenerationPreviewDraft(preview);
    draft.promptDraft.authoredText = 'Updated prompt.\nSecond line.';
    const changed = changeGenerationPreviewReference(
      draft,
      preview.references.slots[0]!,
      null
    );

    expect(generationPreviewDraftIsDirty(preview, changed)).toBe(true);
    expect(buildGenerationPreviewUpdateRequest(preview, changed)).toEqual({
      prompt: { authoredText: 'Updated prompt.\nSecond line.' },
      model: {
        provider: 'fal-ai',
        model: 'openai/gpt-image-2/edit',
      },
      parameterValues: {
        image_size: 'landscape_16_9',
        quality: 'high',
        num_images: 1,
      },
      slotSelections: [
        {
          placement: {
            kind: 'slot',
            sectionId: 'continuity',
            slotId: 'style',
          },
          reference: null,
        },
      ],
    });
  });

  it('replaces a slot with one exact candidate', () => {
    const preview = previewFixture();
    const draft = createGenerationPreviewDraft(preview);
    const replacement = {
      ...preview.references.slots[0]!.eligibleCandidates[0]!,
      assetId: 'asset_replacement',
      assetFileId: 'asset_file_replacement',
      selected: false,
    };
    preview.references.slots[0]!.eligibleCandidates.push(replacement);
    const changed = changeGenerationPreviewReference(
      draft,
      preview.references.slots[0]!,
      replacement
    );

    expect(
      generationPreviewReferenceSelected(
        preview.references.slots[0]!,
        replacement,
        changed
      )
    ).toBe(true);
  });

  it('clears an editable negative prompt with null', () => {
    const preview = previewFixture();
    preview.finalPrompt.negativeText = 'No camera shake.';
    const draft = createGenerationPreviewDraft(preview);
    draft.promptDraft.negativeText = '';

    expect(buildGenerationPreviewUpdateRequest(preview, draft).prompt).toEqual({
      authoredText: 'Original prompt.',
      negativeText: null,
    });
  });

  it('changes the selected model and its configurable values', () => {
    const preview = previewFixture();
    const draft = createGenerationPreviewDraft(preview);
    draft.model = {
      provider: 'fal-ai',
      modelId: 'nano-banana-2',
    };
    draft.parameterValues = {
      aspect_ratio: '16:9',
      enable_web_search: true,
    };
    draft.authoredParameterNames = [
      'aspect_ratio',
      'enable_web_search',
    ];

    expect(generationPreviewDraftIsDirty(preview, draft)).toBe(true);
    expect(buildGenerationPreviewUpdateRequest(preview, draft)).toMatchObject({
      model: {
        provider: 'fal-ai',
        model: 'nano-banana-2',
      },
      parameterValues: {
        aspect_ratio: '16:9',
        enable_web_search: true,
      },
    });
  });
});

function previewFixture(): GenerationPreviewResource {
  return {
    kind: 'generationPreview',
    previewId: 'generation-preview:test',
    generationSpec: { id: 'media_generation_spec_test', frozenAt: null },
    purpose: 'cast.character-sheet',
    project: { id: 'project_test', name: 'constantinople' },
    subject: { projectLabel: 'Constantinople' },
    target: { kind: 'castMember', id: 'cast_test' },
    title: 'Character sheet preview',
    model: {
      provider: 'fal-ai',
      modelId: 'openai/gpt-image-2/edit',
      mediaKind: 'image',
    },
    finalPrompt: {
      authoredText: 'Original prompt.',
      providerText: 'Provider prompt.',
    },
    references: {
      slots: [{
        label: 'Style reference',
        placement: {
          kind: 'slot',
          sectionId: 'continuity',
          slotId: 'style',
        },
        current: {
          kind: 'image',
          role: 'style',
          label: 'Style sheet',
          assetId: 'asset_style',
          assetFileId: 'asset_file_style',
          browserUrl: '/style.png',
          selected: true,
        },
        eligibleCandidates: [{
          kind: 'image', role: 'style', label: 'Style sheet',
          assetId: 'asset_style', assetFileId: 'asset_file_style',
          browserUrl: '/style.png', selected: false,
        }],
      }],
      additional: [],
    },
    configuration: { sections: [] },
    authoring: {
      models: [
        {
          provider: 'fal-ai',
          modelId: 'openai/gpt-image-2/edit',
          label: 'GPT Image 2',
          controls: [
            {
              controlId: 'image_size',
              kind: 'select',
              label: 'Image Size',
              value: 'landscape_16_9',
              required: false,
              authored: true,
              options: [
                { label: 'landscape_16_9', value: 'landscape_16_9' },
              ],
            },
            {
              controlId: 'quality',
              kind: 'select',
              label: 'Quality',
              value: 'high',
              required: false,
              authored: true,
              options: [{ label: 'high', value: 'high' }],
            },
            {
              controlId: 'num_images',
              kind: 'number',
              label: 'Number of Images',
              value: 1,
              required: false,
              authored: true,
            },
          ],
        },
      ],
    },
    diagnostics: [],
  };
}
