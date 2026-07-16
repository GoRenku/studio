// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GenericReferencePickerDialog } from './reference-picker-dialog';

const generationReferencesApi = vi.hoisted(() => ({
  listStudioGenerationReferences: vi.fn(),
}));

vi.mock('@/services/studio-generation-references-api', () =>
  generationReferencesApi
);

describe('GenericReferencePickerDialog', () => {
  it('searches and selects image, audio, and video project media', async () => {
    generationReferencesApi.listStudioGenerationReferences.mockResolvedValue({
      items: [
        catalogItem('image', 'Maria reference'),
        catalogItem('audio', 'Courtyard ambience'),
        catalogItem('video', 'Camera rehearsal'),
      ],
      nextCursor: null,
    });
    const onChange = vi.fn();
    render(
      <GenericReferencePickerDialog
        open
        projectName='urban-basilica'
        selected={[]}
        onOpenChange={vi.fn()}
        onChange={onChange}
      />
    );

    expect(await screen.findByText('Maria reference')).toBeTruthy();
    expect(screen.getByText('Courtyard ambience')).toBeTruthy();
    expect(screen.getByText('Camera rehearsal')).toBeTruthy();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search project media' }), {
      target: { value: 'courtyard' },
    });
    await waitFor(() => expect(
      generationReferencesApi.listStudioGenerationReferences
    ).toHaveBeenLastCalledWith({
      projectName: 'urban-basilica',
      search: 'courtyard',
      limit: 60,
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Courtyard ambience' }));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        label: 'Courtyard ambience',
        mediaKind: 'audio',
        reference: expect.objectContaining({ kind: 'asset-file' }),
      }),
    ]);
  });

  it('loads the next catalog page without replacing prior results', async () => {
    generationReferencesApi.listStudioGenerationReferences
      .mockResolvedValueOnce({
        items: [catalogItem('image', 'First page')],
        nextCursor: 'page-two',
      })
      .mockResolvedValueOnce({
        items: [catalogItem('video', 'Second page')],
        nextCursor: null,
      });
    render(
      <GenericReferencePickerDialog
        open
        projectName='urban-basilica'
        selected={[]}
        onOpenChange={vi.fn()}
        onChange={vi.fn()}
      />
    );

    expect(await screen.findByText('First page')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Load More' }));
    expect(await screen.findByText('Second page')).toBeTruthy();
    expect(screen.getByText('First page')).toBeTruthy();
  });
});

function catalogItem(
  mediaKind: 'image' | 'audio' | 'video',
  label: string,
) {
  return {
    reference: {
      kind: 'asset-file' as const,
      assetId: `asset_${mediaKind}`,
      assetFileId: `file_${mediaKind}`,
    },
    label,
    mediaKind,
    mimeType: null,
    sizeBytes: null,
    width: null,
    height: null,
    durationSeconds: null,
    role: 'imported-media',
    provenance: { origin: 'imported' },
    browserUrl: `/media/${mediaKind}`,
  };
}
