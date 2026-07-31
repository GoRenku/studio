// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readPropOverviewResource } from '@/services/studio-continuity-api';
import { PropOverviewPanel } from './prop-overview-panel';

vi.mock('@/services/studio-continuity-api', () => ({
  readPropOverviewResource: vi.fn(),
}));

describe('PropOverviewPanel', () => {
  beforeEach(() => {
    vi.mocked(readPropOverviewResource).mockReset();
  });

  it('shows authored Prop names without invented subtitles and opens the Prop', async () => {
    vi.mocked(readPropOverviewResource).mockResolvedValue({
      props: {
        items: [
          {
            id: 'prop_cannon',
            handle: 'field-cannon',
            name: 'Field Cannon',
            firstImage: {
              assetId: 'asset_cannon_hero',
              assetFileId: 'asset_file_cannon_hero',
              title: 'Cannon hero',
              fileRole: 'primary',
              mediaKind: 'image',
              mimeType: 'image/png',
              width: 1200,
              height: 900,
              url: '/studio-api/projects/constantinople/assets/asset_cannon_hero/files/asset_file_cannon_hero',
            },
          },
        ],
        nextCursor: null,
      },
    });
    const onSelect = vi.fn();

    render(
      <PropOverviewPanel projectName='constantinople' onSelect={onSelect} />
    );

    const card = await screen.findByRole('button', { name: 'Field Cannon' });
    expect(screen.queryByText('Prop')).toBeNull();
    expect(screen.getByAltText('Field Cannon prop hero image')).toBeTruthy();
    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledWith({
      type: 'prop',
      id: 'prop_cannon',
    });
  });
});
