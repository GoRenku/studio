// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudioAssetFileResponse } from '@/services/studio-project-contracts';
import {
  deleteProjectCoverAssetFile,
  readProjectCoverAssetFiles,
  selectProjectCoverAssetFile,
} from '@/services/studio-project-assets-api';
import { readProject } from '@/services/studio-projects-api';
import { Button } from '@/ui/button';
import { ProjectCoversTab } from './project-covers-tab';

vi.mock('@/services/studio-project-assets-api', () => ({
  clearSelectedProjectCover: vi.fn(),
  deleteProjectCoverAssetFile: vi.fn(),
  readProjectCoverAssetFiles: vi.fn(),
  selectProjectCoverAssetFile: vi.fn(),
}));
vi.mock('@/services/studio-projects-api', () => ({ readProject: vi.fn() }));
vi.mock('./project-cover-cards', () => ({
  ProjectCoverCards: (props: {
    assetFiles: StudioAssetFileResponse[];
    onToggleSelected: (assetFile: StudioAssetFileResponse) => Promise<void>;
    onDelete: (assetFile: StudioAssetFileResponse) => Promise<void>;
  }) => (
    <div>
      <Button type='button' onClick={() => void props.onToggleSelected(props.assetFiles[0]!)}>
        Toggle cover
      </Button>
      <Button type='button' onClick={() => void props.onDelete(props.assetFiles[0]!)}>
        Delete cover
      </Button>
    </div>
  ),
}));

describe('ProjectCoversTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readProjectCoverAssetFiles).mockResolvedValue({
      items: [{ id: 'asset_cover' } as StudioAssetFileResponse],
      selectedAssetFileId: null,
    });
    vi.mocked(selectProjectCoverAssetFile).mockResolvedValue({
      valid: true,
      warnings: [],
      project: {
        id: 'project_1',
        projectName: 'movie',
        projectFolder: '/projects/movie',
      },
      target: { kind: 'project' },
      selectedAssetFileId: 'asset_cover',
      resourceKeys: [
        'surface:project:covers',
        'project-shell',
        'project-library',
      ],
    });
    vi.mocked(deleteProjectCoverAssetFile).mockResolvedValue({
      valid: true,
      warnings: [],
      project: {
        id: 'project_1',
        projectName: 'movie',
        projectFolder: '/projects/movie',
      },
      changes: [{ type: 'asset.discarded', assetFileId: 'asset_cover' }],
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
    await waitFor(() => expect(deleteProjectCoverAssetFile).toHaveBeenCalled());
    expect(onProjectChange).toHaveBeenCalledTimes(1);
  });
});

function project() {
  return {
    project: { id: 'project_1', projectName: 'movie' },
    coverUrl: null,
  };
}
