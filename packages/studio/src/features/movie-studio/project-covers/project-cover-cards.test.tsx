// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { StudioAssetResponse } from '@/services/studio-project-contracts';
import { ProjectCoverCards } from './project-cover-cards';

describe('ProjectCoverCards', () => {
  it('composes fixed cover cards with preview, selection, and Trash actions', async () => {
    const onToggleSelected = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <ProjectCoverCards
        assets={[coverAsset()]}
        selectedAssetId={null}
        onToggleSelected={onToggleSelected}
        onDelete={onDelete}
      />
    );

    expect(screen.getByText('Project Covers')).not.toBeNull();
    expect(screen.getByText('1 image')).not.toBeNull();
    expect(screen.queryByText('cover-file.png')).toBeNull();
    expect(
      container.querySelector('[data-media-card]')?.getAttribute('style')
    ).toContain(`aspect-ratio: ${16 / 9}`);

    fireEvent.click(
      screen.getByRole('button', { name: 'Use as active Project cover' })
    );
    expect(onToggleSelected).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'asset_cover' })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Quiet dramatic cover' }));
    expect(await screen.findByRole('dialog')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close image preview' }));

    fireEvent.click(
      screen.getByRole('button', { name: 'Move Project cover to Trash' })
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Move to Trash' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
  });
});

function coverAsset(): StudioAssetResponse {
  return {
    id: 'asset_cover',
    owner: { kind: 'project' },
    localeId: null,
    type: 'project_cover',
    availability: 'ready',
    mediaKind: 'image',
    title: 'Project Cover',
    oneLineSummary: 'Quiet dramatic cover',
    origin: 'generated',
    referenceName: null,
    tags: [],
    files: [{
      id: 'asset_file_cover',
      role: 'primary',
      mediaKind: 'image',
      mimeType: 'image/png',
      sizeBytes: 100,
      contentHash: null,
      width: 1600,
      height: 900,
      durationSeconds: null,
      url: '/studio-api/projects/movie/assets/asset_cover/files/asset_file_cover',
    }],
    createdAt: '2026-08-19T00:00:00.000Z',
    updatedAt: '2026-08-19T00:00:00.000Z',
  };
}
