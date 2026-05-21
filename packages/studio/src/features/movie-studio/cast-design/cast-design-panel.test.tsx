// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import type { CastMember } from '@gorenku/studio-core/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readCastDesignResource } from '@/services/studio-project-assets-api';
import { CastDesignPanel } from './cast-design-panel';

vi.mock('@/services/studio-project-assets-api', () => ({
  castAssetFileUrl: vi.fn(),
  invalidateCastDesignResource: vi.fn(),
  readCastDesignResource: vi.fn(),
  selectCastAsset: vi.fn(),
  unselectCastAsset: vi.fn(),
}));

describe('CastDesignPanel', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows the SQLite-backed cast description from the design resource', async () => {
    vi.mocked(readCastDesignResource).mockResolvedValue({
      castMember,
      selectedAssets: [],
      activeTakePage: { items: [], nextCursor: null },
      countsByRole: [],
    });

    render(
      <CastDesignPanel
        projectName='constantinople'
        castEntry={castMember}
      />
    );

    expect(await screen.findByText('A sharp court historian.')).toBeTruthy();
    expect(readCastDesignResource).toHaveBeenCalledWith(
      'constantinople',
      'cast_1'
    );
    await waitFor(() => expect(readCastDesignResource).toHaveBeenCalledTimes(1));
  });
});

const castMember: CastMember = {
  id: 'cast_1',
  name: 'Anna Komnene',
  shortDescription: 'A sharp court historian.',
};
