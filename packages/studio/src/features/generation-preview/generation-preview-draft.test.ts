import { describe, expect, it } from 'vitest';
import type { GenerationPreviewResource } from '@gorenku/studio-core/client';
import {
  buildGenerationPreviewUpdateRequest,
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
      generationPreviewReferenceSelected(preview.references[0]!, draft)
    ).toBe(true);
    expect(generationPreviewDraftIsDirty(preview, draft)).toBe(false);
  });

  it('builds one update envelope from prompt and local reference changes', () => {
    const preview = previewFixture();
    const draft = createGenerationPreviewDraft(preview);
    draft.promptDraft.authoredText = 'Updated prompt.\nSecond line.';
    draft.referenceSelectionDraftBySelectionId.selection_style = false;

    expect(generationPreviewDraftIsDirty(preview, draft)).toBe(true);
    expect(buildGenerationPreviewUpdateRequest(preview, draft)).toEqual({
      prompt: { authoredText: 'Updated prompt.\nSecond line.' },
      referenceSelections: [
        { selectionId: 'selection_style', selected: false },
      ],
    });
  });

  it('keeps required references selected', () => {
    const preview = previewFixture();
    preview.references[0]!.selectionControl!.required = true;
    preview.references[0]!.selected = true;
    const draft = createGenerationPreviewDraft(preview);
    draft.referenceSelectionDraftBySelectionId.selection_style = false;

    expect(
      generationPreviewReferenceSelected(preview.references[0]!, draft)
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
});

function previewFixture(): GenerationPreviewResource {
  return {
    kind: 'generationPreview',
    previewId: 'generation-preview:test',
    generationSpecId: 'media_generation_spec_test',
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
    references: [
      {
        kind: 'image',
        role: 'style',
        label: 'Style sheet',
        assetId: 'asset_style',
        assetFileId: 'asset_file_style',
        browserUrl: '/style.png',
        selected: true,
        selectionControl: {
          selectionId: 'selection_style',
          required: false,
          defaultIncluded: true,
          editable: true,
        },
      },
    ],
    configuration: { sections: [] },
    diagnostics: [],
  };
}
