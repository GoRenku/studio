// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useImageRevisionEditor } from './use-image-revision-editor';

const imageRevisionApi = vi.hoisted(() => ({
  estimateImageRevisionDraft: vi.fn(),
  readImageRevisionContext: vi.fn(),
  runImageRevision: vi.fn(),
}));

vi.mock('@/services/studio-image-revisions-api', () => imageRevisionApi);

describe('useImageRevisionEditor', () => {
  it('keeps the source preview visible while edit instructions are empty', async () => {
    const request = {
      projectName: 'urban-basilica',
      target: {
        kind: 'castCharacterSheet' as const,
        castMemberId: 'cast_urban',
        assetId: 'asset_source',
        assetFileId: 'file_source',
      },
    };
    const preview = {
      model: {
        provider: 'fal-ai',
        modelId: 'openai/gpt-image-2/edit',
      },
      finalPrompt: { authoredText: '' },
      references: { slots: [], additional: [] },
      authoring: { models: [] },
    } as never;
    imageRevisionApi.readImageRevisionContext.mockResolvedValue({
      target: {
        kind: 'castCharacterSheet',
        castMemberId: 'cast_urban',
        assetId: 'asset_source',
        assetFileId: 'file_source',
      },
      source: {
        title: 'Urban character sheet',
        assetId: 'asset_source',
        assetFileId: 'file_source',
      },
      regenerate: {
        state: 'unavailable',
        mode: 'regenerate',
        diagnostics: [],
      },
      edit: {
        state: 'available',
        mode: 'edit',
        draft: {
          mode: 'edit',
          authoredText: '',
          generationControls: [],
        },
        preview,
        controls: [],
        diagnostics: [],
      },
    });
    imageRevisionApi.estimateImageRevisionDraft.mockResolvedValue({
      preview,
      estimatedUsd: null,
    });
    const { result } = renderHook(() =>
      useImageRevisionEditor(request, vi.fn())
    );

    await act(async () => {
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.preview).toBe(preview);

    act(() => result.current.updateAuthoredText(''));

    expect(result.current.preview).toBe(preview);
    expect(result.current.editorDraft?.slotSelections).toEqual([]);
    expect(result.current.editorDraft?.parameterValues).toEqual({});
  });
});
