// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readSceneShotListResource } from '@/services/studio-screenplay-api';
import {
  createShotVideoTake,
  discardShotVideoTake,
  listShotVideoTakes,
  readShotVideoTakeWorkspace,
  replaceShotVideoTakeShots,
  setShotVideoTakePicked,
} from '@/services/studio-shot-video-takes-api';
import { SceneTakesTab } from './scene-takes-tab';

vi.mock('@/services/studio-screenplay-api', () => ({
  readSceneShotListResource: vi.fn(),
}));
vi.mock('@/services/studio-shot-video-takes-api', () => ({
  createShotVideoTake: vi.fn(),
  discardShotVideoTake: vi.fn(),
  listShotVideoTakes: vi.fn(),
  readShotVideoTakeWorkspace: vi.fn(),
  replaceShotVideoTakeShots: vi.fn(),
  setShotVideoTakePicked: vi.fn(),
}));
vi.mock('@/services/studio-trash-api', () => ({
  restoreTrashItem: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe('SceneTakesTab', () => {
  beforeEach(() => {
    vi.mocked(readSceneShotListResource).mockReset().mockResolvedValue(
      resource() as never
    );
    vi.mocked(listShotVideoTakes).mockReset().mockResolvedValue({
      takes: [overview() as never],
    });
    vi.mocked(createShotVideoTake).mockReset();
    vi.mocked(discardShotVideoTake).mockReset().mockResolvedValue({
      resourceKeys: [],
      recovery: {
        operationId: 'operation_001',
        trashItemIds: ['trash_001'],
        restorable: true,
        restoreCommand: { name: 'trash.restore', trashItemId: 'trash_001' },
      },
    });
    vi.mocked(setShotVideoTakePicked).mockReset().mockResolvedValue({
      take: overview().take,
      resourceKeys: [],
    });
    vi.mocked(readShotVideoTakeWorkspace).mockReset();
    vi.mocked(replaceShotVideoTakeShots).mockReset();
  });

  it('renders Storyboard previews instead of a placeholder', async () => {
    render(<SceneTakesTab projectName='constantinople' sceneId='scene_001' />);
    expect((
      await screen.findByRole('img', {
        name: 'Storyboard image for Shot 1',
      })
    ).getAttribute('src')).toBe('/storyboard-1.png');
    expect(screen.queryByText('Take')).toBeNull();
  });

  it('renders the final video before Storyboard imagery', async () => {
    const take = overview();
    const takeWithVideo = {
      ...take,
      take: {
        ...take.take,
        video: {
          takeId: 'take_001',
          assetId: 'asset_video',
          assetFileId: 'file_video',
          projectRelativePath: 'generated/media/take.mp4',
          mimeType: 'video/mp4',
          createdAt: '2026-07-12T00:00:00.000Z',
          url: '/take.mp4',
        },
      },
    };
    vi.mocked(listShotVideoTakes).mockResolvedValue({
      takes: [takeWithVideo as never],
    });
    render(<SceneTakesTab projectName='constantinople' sceneId='scene_001' />);
    expect((await screen.findByTitle('Shot 1')).getAttribute('src')).toBe(
      '/take.mp4'
    );
    expect(
      screen.queryByRole('img', { name: 'Storyboard image for Shot 1' })
    ).toBeNull();
  });

  it('preserves picked-state interaction', async () => {
    render(<SceneTakesTab projectName='constantinople' sceneId='scene_001' />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Set Shot 1 pick' })
    );
    await waitFor(() =>
      expect(setShotVideoTakePicked).toHaveBeenCalledWith(
        'constantinople',
        'scene_001',
        'take_001',
        true
      )
    );
  });

  it('preserves delete confirmation and recoverable discard', async () => {
    render(<SceneTakesTab projectName='constantinople' sceneId='scene_001' />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Delete Shot 1' })
    );
    expect(screen.getByText('Delete Take?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(discardShotVideoTake).toHaveBeenCalledWith(
        'constantinople',
        'scene_001',
        'take_001'
      )
    );
  });
});

function overview() {
  const take = {
    takeId: 'take_001',
    sceneId: 'scene_001',
    sourceShotListId: 'shot_list_001',
    title: 'Take 1',
    shotIds: ['shot_001'],
    picked: false,
    video: null,
    state: {
      version: 3 as const,
      structure: { mode: 'continuous' as const, sharedDirection: {} },
    },
    status: {
      editability: {
        state: 'editable' as const,
        diagnostics: [],
        message: 'This take is editable.',
      },
      resolvability: {
        state: 'resolvable' as const,
        diagnostics: [],
        message: 'All references resolve.',
      },
      archive: { state: 'active' as const, message: 'Active.' },
      history: { differences: [], message: 'No differences.' },
    },
    createdAt: '2026-07-12T00:00:00.000Z',
    updatedAt: '2026-07-12T00:00:00.000Z',
  };
  return {
    take,
    sourceShotList: {
      id: 'shot_list_001',
      title: 'Shots',
      summary: 'Coverage.',
      createdAt: take.createdAt,
      updatedAt: take.updatedAt,
      isActive: true,
    },
    displayShots: [shot()],
    overviewShotIds: ['shot_001'],
    storyboardImages: [{
      shotId: 'shot_001',
      assetId: 'asset_storyboard',
      relationshipId: 'relationship_storyboard',
      assetFileId: 'file_storyboard',
      title: 'Shot 1',
      fileRole: 'storyboard',
      mediaKind: 'image',
      mimeType: 'image/png',
      width: 1600,
      height: 900,
      projectRelativePath: 'generated/media/storyboard.png',
      url: '/storyboard-1.png',
    }],
  };
}

function resource() {
  return {
    scene: {
      id: 'scene_001',
      sequenceId: 'sequence_001',
      title: 'The Gate',
      setting: { locationIds: [] },
    },
    sequence: {
      id: 'sequence_001',
      actId: 'act_001',
      number: 1,
      title: 'Opening',
      sceneCount: 1,
    },
    act: {
      id: 'act_001',
      title: 'Act 1',
      sequenceCount: 1,
      sceneCount: 1,
    },
    projectAspectRatio: '16:9',
    activeShotListId: 'shot_list_001',
    activeShotList: {
      id: 'shot_list_001',
      title: 'Shots',
      summary: 'Coverage.',
      coverageStrategy: 'Continuous',
      shots: [shot()],
    },
    storyboardImagesByShotId: {},
    castMemberLabels: {},
    castMemberImages: {},
    locationLabels: {},
  };
}

function shot() {
  return {
    shotId: 'shot_001',
    title: 'Shot 1',
    storyBeat: 'The gate holds.',
    narrativePurpose: 'Establish pressure.',
    description: 'Defenders brace.',
    shotType: 'Wide',
    subject: 'The gate',
    action: 'Defenders brace.',
    dialogue: [],
    coveredBlockIndexes: [0],
    castMemberIds: [],
    locationIds: [],
  };
}
