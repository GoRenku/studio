// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudioAssetResponse } from '@/services/studio-project-contracts';
import {
  deleteProjectCoverAsset,
  readProjectCoverAssets,
  selectProjectCoverAsset,
} from '@/services/studio-project-assets-api';
import { readProject } from '@/services/studio-projects-api';
import { Button } from '@/ui/button';
import { ProjectCoversTab } from './project-covers-tab';

vi.mock('@/services/studio-project-assets-api', () => ({
  clearSelectedProjectCover: vi.fn(),
  deleteProjectCoverAsset: vi.fn(),
  readProjectCoverAssets: vi.fn(),
  selectProjectCoverAsset: vi.fn(),
}));
vi.mock('@/services/studio-projects-api', () => ({ readProject: vi.fn() }));
vi.mock('./project-cover-cards', () => ({
  ProjectCoverCards: (props: {
    assets: StudioAssetResponse[];
    onToggleSelected: (asset: StudioAssetResponse) => Promise<void>;
    onDelete: (asset: StudioAssetResponse) => Promise<void>;
  }) => (
    <div>
      <Button type='button' onClick={() => void props.onToggleSelected(props.assets[0]!)}>
        Toggle cover
      </Button>
      <Button type='button' onClick={() => void props.onDelete(props.assets[0]!)}>
        Delete cover
      </Button>
    </div>
  ),
}));

describe('ProjectCoversTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readProjectCoverAssets).mockResolvedValue({
      items: [{ id: 'asset_cover' } as StudioAssetResponse],
      selectedAssetId: null,
    });
    vi.mocked(selectProjectCoverAsset).mockResolvedValue({
      valid: true,
      warnings: [],
      project: {
        id: 'project_1',
        projectName: 'movie',
        projectFolder: '/projects/movie',
      },
      target: { kind: 'project' },
      selectedAssetId: 'asset_cover',
      resourceKeys: [
        'surface:project:covers',
        'project-shell',
        'project-library',
      ],
    });
    vi.mocked(deleteProjectCoverAsset).mockResolvedValue({
      valid: true,
      warnings: [],
      project: {
        id: 'project_1',
        projectName: 'movie',
        projectFolder: '/projects/movie',
      },
      changes: [{ type: 'asset.discarded', assetId: 'asset_cover' }],
      recovery: {
        operationId: 'trash_1',
        trashItemIds: ['trash_item_1'],
        restorable: true,
        restoreCommand: { name: 'trash.restore', trashItemId: 'trash_item_1' },
      },
      resourceKeys: ['surface:project:covers', 'trash:list'],
    });
    vi.mocked(readProject).mockResolvedValue(project() as never);
  });

  it('reloads the Project Shell only when mutation keys include it', async () => {
    const onProjectChange = vi.fn();
    render(
      <ProjectCoversTab
        project={project() as never}
        onProjectChange={onProjectChange}
      />
    );
    await screen.findByRole('button', { name: 'Toggle cover' });

    fireEvent.click(screen.getByRole('button', { name: 'Toggle cover' }));
    await waitFor(() => expect(onProjectChange).toHaveBeenCalledTimes(1));
    expect(readProject).toHaveBeenCalledWith('movie');

    fireEvent.click(screen.getByRole('button', { name: 'Delete cover' }));
    await waitFor(() => expect(deleteProjectCoverAsset).toHaveBeenCalled());
    expect(onProjectChange).toHaveBeenCalledTimes(1);
  });
});

function project() {
  return {
    project: { id: 'project_1', projectName: 'movie' },
    coverUrl: null,
  };
}
