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
vi.mock('@/services/studio-trash-api', () => ({ restoreTrashItem: vi.fn() }));
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe('Scene Takes workspace integration', () => {
  beforeEach(() => {
    vi.mocked(readSceneShotListResource).mockResolvedValue(resource() as never);
    vi.mocked(listShotVideoTakes).mockResolvedValue({ takes: [overview() as never] });
    vi.mocked(createShotVideoTake).mockResolvedValue({
      overview: overview() as never,
      resourceKeys: [],
    });
    vi.mocked(discardShotVideoTake).mockResolvedValue({
      resourceKeys: [],
      recovery: {
        operationId: 'operation_001',
        trashItemIds: ['trash_001'],
        restorable: true,
        restoreCommand: { name: 'trash.restore', trashItemId: 'trash_001' },
      },
    });
    vi.mocked(setShotVideoTakePicked).mockImplementation(
      async (_projectName, _sceneId, _takeId, picked) => ({
        take: { ...overview().take, picked },
        resourceKeys: [],
      })
    );
    vi.mocked(readShotVideoTakeWorkspace).mockResolvedValue(workspace() as never);
    vi.mocked(replaceShotVideoTakeShots).mockResolvedValue({
      workspace: workspace() as never,
      resourceKeys: [],
    });
  });

  it('renders ordered take cards with Storyboard media and pick controls', async () => {
    render(<SceneTakesTab projectName='constantinople' sceneId='scene_001' />);
    expect((await screen.findAllByText('Shot 1')).length).toBeGreaterThan(0);
    expect((
      screen.getByRole('img', { name: 'Storyboard image for Shot 1' })
    ).getAttribute('src')).toBe('/storyboard.png');
    fireEvent.click(screen.getByRole('button', { name: 'Set Shot 1 pick' }));
    await waitFor(() =>
      expect(setShotVideoTakePicked).toHaveBeenCalledWith(
        'constantinople',
        'scene_001',
        'take_001',
        true
      )
    );
  });

  it('opens the selected take editing workspace through the same deep link', async () => {
    render(
      <SceneTakesTab
        projectName='constantinople'
        sceneId='scene_001'
        takeWorkspaceMode='edit'
        takeId='take_001'
      />
    );
    await waitFor(() =>
      expect(readShotVideoTakeWorkspace).toHaveBeenCalledWith(
        'constantinople',
        'scene_001',
        'take_001'
      )
    );
    expect(await screen.findByRole('tab', { name: 'Description' })).toBeTruthy();
  });

  it('keeps delete behind confirmation and uses recoverable discard', async () => {
    render(<SceneTakesTab projectName='constantinople' sceneId='scene_001' />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Shot 1' }));
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
  return {
    take: take(),
    sourceShotList: {
      id: 'shot_list_001',
      title: 'Shots',
      summary: 'Coverage.',
      createdAt: '2026-07-12T00:00:00.000Z',
      updatedAt: '2026-07-12T00:00:00.000Z',
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
      url: '/storyboard.png',
    }],
  };
}

function workspace() {
  return {
    take: take(),
    sourceShotList: overview().sourceShotList,
    sourceShots: [shot()],
    displayShots: [shot()],
    storyboardImages: overview().storyboardImages,
    generation: {
      context: {
        purpose: 'shot.video-take',
        target: { kind: 'sceneShotVideoTake', id: 'take_001' },
        outputMediaKind: 'video',
        facts: {},
        settings: { fixed: [], recommended: [] },
        models: [],
        referenceGuide: { sections: [], notices: [] },
      },
      spec: null,
      setup: { inputModeId: 'text-only', parameterValues: {} },
      models: [],
      references: {
        kind: 'draft',
        general: [],
        genericReferences: [],
        lookbook: [],
        dialogueAudio: [],
        dialogueAudioCapability: {
          state: 'unsupported',
          supported: false,
          selectedCount: 0,
          maxCount: null,
          modelLabel: 'Selected model',
          message: 'This model does not use audio references.',
          diagnostics: [],
        },
        castMembers: [],
        locations: [],
      },
      authoringState: { kind: 'draft', failedAttemptCount: 0 },
      finalPrompt: null,
      estimate: null,
      run: null,
      diagnostics: [],
    },
    resourceKeys: [],
  };
}

function take() {
  return {
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
}

function resource() {
  return {
    scene: { id: 'scene_001', title: 'The Gate', setting: { locationIds: [] } },
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
