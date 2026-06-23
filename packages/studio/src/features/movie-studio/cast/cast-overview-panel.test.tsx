// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CastOverviewResourceResponse } from '@/services/studio-project-contracts';
import { readCastOverviewResource } from '@/services/studio-screenplay-api';
import { CastOverviewPanel } from './cast-overview-panel';

vi.mock('@/services/studio-screenplay-api', () => ({
  readCastOverviewResource: vi.fn(),
}));

describe('CastOverviewPanel', () => {
  beforeEach(() => {
    vi.mocked(readCastOverviewResource).mockReset();
  });

  it('shows an intentional voice-only preview when a voice-over cast member has no profile image', async () => {
    vi.mocked(readCastOverviewResource).mockResolvedValue(
      castOverviewResource([
        {
          id: 'cast_narrator',
          handle: 'narrator',
          name: 'Narrator',
          role: 'historical voice-over',
          isVoiceOver: true,
        },
      ])
    );
    const onSelect = vi.fn();

    render(
      <CastOverviewPanel projectName='constantinople' onSelect={onSelect} />
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Narrator' }));

    expect(screen.getByTestId('voice-over-profile-placeholder')).toBeTruthy();
    expect(onSelect).toHaveBeenCalledWith({
      type: 'castMember',
      id: 'cast_narrator',
    });
  });

  it('keeps the missing-image state for non-voice-over cast members with no profile image', async () => {
    vi.mocked(readCastOverviewResource).mockResolvedValue(
      castOverviewResource([
        {
          id: 'cast_saruca',
          handle: 'saruca',
          name: 'Saruca',
          role: 'Ottoman master founder',
          isVoiceOver: false,
        },
      ])
    );

    render(
      <CastOverviewPanel projectName='constantinople' onSelect={vi.fn()} />
    );

    expect(await screen.findByRole('button', { name: 'Saruca' })).toBeTruthy();
    expect(screen.queryByTestId('voice-over-profile-placeholder')).toBeNull();
  });

  it('shows an imported profile image for voice-over cast members when one exists', async () => {
    vi.mocked(readCastOverviewResource).mockResolvedValue(
      castOverviewResource([
        {
          id: 'cast_narrator',
          handle: 'narrator',
          name: 'Narrator',
          role: 'historical voice-over',
          isVoiceOver: true,
          firstImage: {
            assetId: 'asset_narrator_profile',
            relationshipId: 'asset_relationship_narrator_profile',
            assetFileId: 'asset_file_narrator_profile',
            title: 'Narrator profile',
            fileRole: 'primary',
            mediaKind: 'image',
            mimeType: 'image/png',
            width: 1024,
            height: 1024,
            url: '/studio-api/projects/constantinople/cast/cast_narrator/assets/asset_narrator_profile/files/asset_file_narrator_profile',
          },
        },
      ])
    );

    render(
      <CastOverviewPanel projectName='constantinople' onSelect={vi.fn()} />
    );

    expect(
      await screen.findByAltText('Narrator profile image')
    ).toBeTruthy();
    expect(screen.queryByTestId('voice-over-profile-placeholder')).toBeNull();
  });
});

function castOverviewResource(
  items: CastOverviewResourceResponse['cast']['items']
): CastOverviewResourceResponse {
  return {
    cast: {
      items,
      nextCursor: null,
    },
  };
}
