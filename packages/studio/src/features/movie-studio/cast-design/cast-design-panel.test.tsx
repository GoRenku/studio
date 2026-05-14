// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import type {
  CastMember,
  MarkdownAssetContent,
  RichTextAssetLink,
} from '@gorenku/studio-core/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  readCastDesignResource,
  readMarkdownAssetContent,
} from '@/services/studio-project-assets-api';
import { CastDesignPanel } from './cast-design-panel';

vi.mock('@/services/studio-project-assets-api', () => ({
  castAssetFileUrl: vi.fn(),
  invalidateCastDesignResource: vi.fn(),
  readCastDesignResource: vi.fn(),
  readMarkdownAssetContent: vi.fn(),
  selectCastAsset: vi.fn(),
  unselectCastAsset: vi.fn(),
  updateMarkdownAssetContent: vi.fn(),
}));

describe('CastDesignPanel', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loads the cast description Markdown content through the Markdown endpoint', async () => {
    const descriptionAsset = makeDescriptionAsset();
    vi.mocked(readCastDesignResource).mockResolvedValue({
      castMember,
      descriptionAsset,
      selectedAssets: [],
      activeTakePage: { items: [], nextCursor: null },
      countsByRole: [],
    });
    vi.mocked(readMarkdownAssetContent).mockResolvedValue(
      makeMarkdownContent(descriptionAsset, 'Detailed cast description from Markdown.')
    );

    render(
      <CastDesignPanel
        projectName='constantinople'
        castEntry={castMember}
        onProjectChange={() => undefined}
      />
    );

    expect(
      await screen.findByDisplayValue('Detailed cast description from Markdown.')
    ).toBeTruthy();
    expect(readCastDesignResource).toHaveBeenCalledWith(
      'constantinople',
      'cast_1'
    );
    await waitFor(() => {
      expect(readMarkdownAssetContent).toHaveBeenCalledWith('constantinople', {
        assetId: 'asset_cast_description',
        assetFileId: 'asset_file_cast_description',
      });
    });
  });
});

const castMember: CastMember = {
  id: 'cast_1',
  name: 'Anna Komnene',
  shortDescription: 'A sharp court historian.',
};

function makeDescriptionAsset(): RichTextAssetLink {
  return {
    assetId: 'asset_cast_description',
    assetFileId: 'asset_file_cast_description',
    role: 'description',
    projectRelativePath: 'working-assets/base/cast/01-anna/description.md',
  };
}

function makeMarkdownContent(
  asset: RichTextAssetLink,
  content: string
): MarkdownAssetContent {
  return {
    assetId: asset.assetId,
    assetFileId: asset.assetFileId,
    projectRelativePath: asset.projectRelativePath,
    content,
  };
}
