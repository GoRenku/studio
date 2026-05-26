// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CastMemberResourceResponse,
  StudioAssetResponse,
} from '@/services/studio-project-contracts';
import {
  readCastAssets,
  selectCastAsset,
  unselectCastAsset,
} from '@/services/studio-project-assets-api';
import { readCastMemberResource } from '@/services/studio-screenplay-api';
import { CastMemberPanel } from './cast-member-panel';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('@/services/studio-project-assets-api', () => ({
  castAssetFileUrl: vi.fn(
    (
      projectName: string,
      castMemberId: string,
      assetId: string,
      fileId: string
    ) =>
      `/studio-api/projects/${projectName}/cast/${castMemberId}/assets/${assetId}/files/${fileId}`
  ),
  deleteCastAsset: vi.fn(),
  readCastAssets: vi.fn(),
  selectCastAsset: vi.fn(),
  unselectCastAsset: vi.fn(),
}));

vi.mock('@/services/studio-screenplay-api', () => ({
  readCastMemberResource: vi.fn(),
}));

describe('CastMemberPanel', () => {
  beforeEach(() => {
    vi.mocked(readCastAssets).mockReset();
    vi.mocked(selectCastAsset).mockReset();
    vi.mocked(unselectCastAsset).mockReset();
    vi.mocked(readCastMemberResource).mockReset();
  });

  it('unselects the current profile pick when the pick control is clicked again', async () => {
    vi.mocked(readCastMemberResource).mockResolvedValue(castMemberResource());
    vi.mocked(readCastAssets)
      .mockResolvedValueOnce([castProfileAsset({ selected: true })])
      .mockResolvedValueOnce([castProfileAsset({ selected: false })]);
    vi.mocked(unselectCastAsset).mockResolvedValue(
      castProfileAsset({ selected: false })
    );

    render(
      <CastMemberPanel
        projectName='constantinople'
        castMemberId='cast_urban'
      />
    );

    const visualContentTab = await screen.findByRole('tab', {
      name: 'Visual Content',
    });
    fireEvent.pointerDown(visualContentTab, { button: 0, ctrlKey: false });
    fireEvent.pointerUp(visualContentTab);
    fireEvent.mouseDown(visualContentTab, { button: 0, ctrlKey: false });
    fireEvent.mouseUp(visualContentTab);
    fireEvent.click(visualContentTab);
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Clear profile image pick',
      })
    );

    await waitFor(() => {
      expect(unselectCastAsset).toHaveBeenCalledWith(
        'constantinople',
        'cast_urban',
        'asset_profile'
      );
    });
    expect(selectCastAsset).not.toHaveBeenCalled();
  });
});

function castMemberResource(): CastMemberResourceResponse {
  return {
    castMember: {
      id: 'cast_urban',
      handle: 'urban',
      name: 'Urban',
      role: 'protagonist',
      description: 'An engineer under pressure.',
    },
  };
}

function castProfileAsset({
  selected,
}: {
  selected: boolean;
}): StudioAssetResponse {
  return {
    assetId: 'asset_profile',
    relationshipId: 'asset_relationship_profile',
    target: { kind: 'castMember', castMemberId: 'cast_urban' },
    localeId: null,
    type: 'cast_profile',
    selection: selected ? { kind: 'select', order: 0 } : { kind: 'take' },
    availability: 'ready',
    mediaKind: 'image',
    title: 'Urban profile',
    oneLineSummary: null,
    origin: 'generated',
    role: 'profile',
    sortOrder: 0,
    files: [
      {
        id: 'asset_file_profile',
        role: 'primary',
        projectRelativePath: 'cast/urban/profile.png' as never,
        mediaKind: 'image',
        mimeType: 'image/png',
        sizeBytes: 123,
        contentHash: null,
        width: 1024,
        height: 1024,
        durationSeconds: null,
      },
    ],
    createdAt: '2026-05-26T00:00:00.000Z',
    updatedAt: '2026-05-26T00:00:00.000Z',
  };
}
