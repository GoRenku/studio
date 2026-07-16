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
      finalPrompt: { authoredText: '' },
      references: { slots: [], additional: [] },
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
          slotSelections: [],
          genericReferences: [],
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

    const slot = {
      label: 'Style reference',
      placement: {
        kind: 'slot' as const,
        sectionId: 'continuity',
        slotId: 'style',
      },
      current: null,
      eligibleCandidates: [],
    };
    const selectedReference = {
      kind: 'image' as const,
      role: 'style',
      label: 'Basilica style',
      assetId: 'asset_style',
      assetFileId: 'file_style',
      selected: true,
      browserUrl: '/style.png',
    };
    act(() => result.current.updateReference(slot, selectedReference));
    expect(result.current.draft?.slotSelections).toEqual([
      expect.objectContaining({
        placement: slot.placement,
        reference: {
          kind: 'asset-file',
          assetId: 'asset_style',
          assetFileId: 'file_style',
        },
      }),
    ]);
    act(() => result.current.updateReference(slot, null));
    expect(result.current.draft?.slotSelections[0]?.reference).toBeNull();

    act(() => result.current.updateGenericReferences([selectedReference]));
    expect(result.current.draft?.genericReferences).toEqual([
      expect.objectContaining({
        placement: { kind: 'additional' },
        reference: {
          kind: 'asset-file',
          assetId: 'asset_style',
          assetFileId: 'file_style',
        },
      }),
    ]);
    expect(result.current.editorDraft?.genericReferences).toEqual([
      selectedReference,
    ]);
  });
});
