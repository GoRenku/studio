// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  GarbageCollectionPreview,
  GarbageCollectionReport,
  RecoverableMutationReport,
  TrashItem,
  TrashListReport,
  TrashProjectReport,
} from '@gorenku/studio-core/client';
import {
  listTrash,
  previewEmptyTrash,
  restoreTrashItem,
  runEmptyTrash,
} from '@/services/studio-trash-api';
import { TrashPanel } from './trash-panel';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/services/studio-trash-api', () => ({
  listTrash: vi.fn(),
  previewEmptyTrash: vi.fn(),
  restoreTrashItem: vi.fn(),
  runEmptyTrash: vi.fn(),
}));

describe('TrashPanel', () => {
  beforeEach(() => {
    vi.mocked(listTrash).mockReset();
    vi.mocked(previewEmptyTrash).mockReset();
    vi.mocked(restoreTrashItem).mockReset();
    vi.mocked(runEmptyTrash).mockReset();
  });

  it('restores a discarded item through the Trash API and refreshes the list', async () => {
    const item = trashItem();
    vi.mocked(listTrash)
      .mockResolvedValueOnce(trashListReport([item]))
      .mockResolvedValueOnce(trashListReport([]));
    vi.mocked(restoreTrashItem).mockResolvedValue(recoverableMutationReport(item));

    render(<TrashPanel projectName='constantinople' />);

    fireEvent.click(await screen.findByRole('button', { name: 'Restore' }));

    await waitFor(() => {
      expect(restoreTrashItem).toHaveBeenCalledWith(
        'constantinople',
        'trash_item_take'
      );
    });
    await waitFor(() => {
      expect(screen.getByText('Trash is empty.')).toBeTruthy();
    });
    expect(listTrash).toHaveBeenCalledTimes(2);
  });

  it('empties Trash after confirmation through the Trash API', async () => {
    const item = trashItem();
    vi.mocked(listTrash)
      .mockResolvedValueOnce(trashListReport([item]))
      .mockResolvedValueOnce(trashListReport([]));
    vi.mocked(previewEmptyTrash).mockResolvedValue(garbageCollectionPreview(item));
    vi.mocked(runEmptyTrash).mockResolvedValue(garbageCollectionReport(item));

    render(<TrashPanel projectName='constantinople' />);

    await screen.findByRole('button', { name: 'Restore' });
    expect(
      screen.getAllByRole('button').map((button) => button.textContent)
    ).toEqual(['Empty', 'Restore']);

    fireEvent.click(await screen.findByRole('button', { name: 'Empty' }));
    expect(screen.getByRole('dialog', { name: 'Empty Trash?' })).toBeTruthy();
    expect(previewEmptyTrash).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(previewEmptyTrash).toHaveBeenCalledWith('constantinople');
      expect(runEmptyTrash).toHaveBeenCalledWith(
        'constantinople',
        'trash_confirmation_token'
      );
    });
    await waitFor(() => {
      expect(screen.getByText('Trash is empty.')).toBeTruthy();
    });
    expect(listTrash).toHaveBeenCalledTimes(2);
  });
});

function trashProject(): TrashProjectReport {
  return {
    id: 'project_test0001',
    name: 'constantinople',
    projectFolder: '/tmp/renku/constantinople',
  };
}

function trashItem(): TrashItem {
  return {
    id: 'trash_item_take',
    operationId: 'trash_operation_take',
    itemKind: 'sceneShotVideoTake',
    itemId: 'scene_shot_video_take_001',
    ownerKind: 'sceneShot',
    ownerId: 'shot_001',
    title: 'Trash restore candidate',
    originalProjectRelativePath: null,
    trashProjectRelativePath: null,
    createdAt: '2026-06-25T09:00:00.000Z',
    restoredAt: null,
    garbageCollectedAt: null,
  };
}

function trashListReport(items: TrashItem[]): TrashListReport {
  return {
    valid: true,
    warnings: [],
    project: trashProject(),
    items,
    resourceKeys: ['project:constantinople:trash'],
  };
}

function recoverableMutationReport(item: TrashItem): RecoverableMutationReport {
  return {
    valid: true,
    warnings: [],
    project: trashProject(),
    changes: [{ type: 'trash.restored', trashItemId: item.id }],
    recovery: {
      operationId: item.operationId,
      trashItemIds: [item.id],
      restorable: false,
      restoreCommand: {
        name: 'trash.restore',
        trashItemId: item.id,
      },
    },
    resourceKeys: ['project:constantinople:trash'],
  };
}

function garbageCollectionPreview(item: TrashItem): GarbageCollectionPreview {
  return {
    valid: true,
    warnings: [],
    project: trashProject(),
    confirmationToken: 'trash_confirmation_token',
    items: [item],
    files: [
      {
        trashItemId: item.id,
        originalProjectRelativePath: 'generated/media/take.mp4',
        trashProjectRelativePath: '.renku/trash/generated/media/take.mp4',
      },
    ],
    resourceKeys: ['project:constantinople:trash'],
  };
}

function garbageCollectionReport(item: TrashItem): GarbageCollectionReport {
  return {
    ...garbageCollectionPreview(item),
    dryRun: false,
    operationId: 'trash_operation_empty',
    manifestProjectRelativePath: '.renku/trash/package-manifest.json',
  };
}
