// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  SceneShot,
  SceneShotListDocument,
  SceneShotVideoTake,
} from '@gorenku/studio-core/client';
import type { SceneShotListResourceResponse } from '@/services/studio-project-contracts';
import { readSceneShotListResource } from '@/services/studio-screenplay-api';
import {
  createSceneShotVideoTake,
  deleteSceneShotVideoTake,
  listSceneShotVideoTakes,
  updateSceneShotVideoTakePick,
  updateSceneShotVideoTakeShots,
} from '@/services/studio-shot-video-takes-api';
import { restoreTrashItem } from '@/services/studio-trash-api';
import type { StudioSelection } from '../movie-studio-selection';
import { SceneTakesTab } from './scene-takes-tab';

vi.mock('@/services/studio-screenplay-api', () => ({
  readSceneShotListResource: vi.fn(),
}));

vi.mock('@/services/studio-shot-video-takes-api', () => ({
  listSceneShotVideoTakes: vi.fn(),
  createSceneShotVideoTake: vi.fn(),
  deleteSceneShotVideoTake: vi.fn(),
  updateSceneShotVideoTakePick: vi.fn(),
  updateSceneShotVideoTakeShots: vi.fn(),
}));

vi.mock('@/services/studio-trash-api', () => ({
  restoreTrashItem: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('SceneTakesTab', () => {
  beforeEach(() => {
    vi.mocked(readSceneShotListResource).mockReset();
    vi.mocked(readSceneShotListResource).mockResolvedValue(resource());
    vi.mocked(listSceneShotVideoTakes).mockReset();
    vi.mocked(listSceneShotVideoTakes).mockResolvedValue({
      takes: [
        take({
          takeId: 'take_reaction',
          title: 'Reaction take',
          shotIds: ['shot_002'],
          updatedAt: '2026-06-18T11:00:00.000Z',
        }),
        take({
          takeId: 'take_map',
          title: 'Map study take',
          shotIds: ['shot_001'],
          updatedAt: '2026-06-18T10:00:00.000Z',
        }),
      ],
    });
    vi.mocked(createSceneShotVideoTake).mockReset();
    vi.mocked(createSceneShotVideoTake).mockResolvedValue(take());
    vi.mocked(deleteSceneShotVideoTake).mockReset();
    vi.mocked(deleteSceneShotVideoTake).mockResolvedValue({
      recovery: {
        operationId: 'trash_operation_test0001',
        trashItemIds: ['trash_item_test0001'],
        restorable: true,
        restoreCommand: {
          name: 'trash.restore',
          trashItemId: 'trash_item_test0001',
        },
      },
      resourceKeys: [],
    });
    vi.mocked(restoreTrashItem).mockReset();
    vi.mocked(updateSceneShotVideoTakePick).mockReset();
    vi.mocked(updateSceneShotVideoTakePick).mockImplementation(
      async (_projectName, _sceneId, takeId, picked) => ({
        take: take({
          takeId,
          title: takeId === 'take_map' ? 'Map study take' : 'Reaction take',
          shotIds: takeId === 'take_map' ? ['shot_001'] : ['shot_002'],
          picked,
          updatedAt: '2026-06-18T12:00:00.000Z',
        }),
        resourceKeys: [],
      })
    );
    vi.mocked(updateSceneShotVideoTakeShots).mockReset();
    vi.mocked(updateSceneShotVideoTakeShots).mockResolvedValue({
      context: {} as never,
      resourceKeys: [],
    });
  });

  it('renders storyboard previews instead of the old Take placeholder', async () => {
    render(<SceneTakesTabHarness />);

    const image = await screen.findByRole('img', {
      name: 'Storyboard image for Shot 1',
    });
    expect(image.getAttribute('src')).toBe('/storyboards/shot-001.png');
    expect(screen.queryByText(/^Take$/)).toBeNull();
  });

  it('updates pick state and orders the picked take first', async () => {
    render(<SceneTakesTabHarness />);

    const reactionCard = await screen.findByRole('button', {
      name: 'Council reaction',
    });
    const mapCard = await screen.findByRole('button', { name: 'Map study' });
    expect(
      Boolean(
        reactionCard.compareDocumentPosition(mapCard) &
          Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Set Map study pick' }));

    await waitFor(() =>
      expect(updateSceneShotVideoTakePick).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        'take_map',
        true
      )
    );

    const pickedMapCard = screen.getByRole('button', { name: 'Map study' });
    const unpickedReactionCard = screen.getByRole('button', {
      name: 'Council reaction',
    });
    expect(
      Boolean(
        pickedMapCard.compareDocumentPosition(unpickedReactionCard) &
          Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true);
  });

  it('confirms before deleting a take card', async () => {
    render(<SceneTakesTabHarness />);

    await screen.findByRole('button', { name: 'Map study' });
    fireEvent.click(screen.getByRole('button', { name: 'Delete Map study' }));
    expect(await screen.findByText('Delete Take?')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(deleteSceneShotVideoTake).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        'take_map'
      )
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Map study' })).toBeNull()
    );
  });
});

function SceneTakesTabHarness() {
  const [selection, setSelection] = React.useState<
    Extract<StudioSelection, { type: 'scene' }>
  >({
    type: 'scene',
    id: 'scene_hook',
    sceneTab: 'takes',
  });
  return (
    <SceneTakesTab
      projectName='constantinople'
      sceneId='scene_hook'
      takeWorkspaceMode={selection.takeWorkspaceMode}
      takeId={selection.takeId}
      shotId={selection.shotId}
      shotTab={selection.shotTab}
      onSelect={(nextSelection) => {
        if (nextSelection.type === 'scene') {
          setSelection(nextSelection);
        }
      }}
    />
  );
}

function shot(id: string, title: string): SceneShot {
  return {
    shotId: id,
    title,
    storyBeat: `${title} story beat.`,
    narrativePurpose: `${title} narrative purpose.`,
    description: `${title} description.`,
    shotType: 'wide',
    subject: title,
    action: `${title} action.`,
    dialogue: [],
    coveredBlockIndexes: [0],
    castMemberIds: [],
    locationIds: [],
  };
}

function shotList(): SceneShotListDocument {
  return {
    kind: 'sceneShotList',
    sceneId: 'scene_hook',
    title: 'Bombardment coverage',
    summary: 'Two shots.',
    coverageStrategy: 'Hold the city wall and reaction.',
    shots: [
      shot('shot_001', 'Map study'),
      shot('shot_002', 'Council reaction'),
    ],
  };
}

function resource(): SceneShotListResourceResponse {
  return {
    scene: {
      id: 'scene_hook',
      sequenceId: 'seq_offer',
      title: 'Bombardment',
    },
    sequence: {
      id: 'seq_offer',
      actId: 'act_one',
      number: 1,
      title: 'The Sound That Opens Stone',
      sceneCount: 1,
    },
    act: {
      id: 'act_one',
      title: 'The Offer',
      sequenceCount: 1,
      sceneCount: 1,
    },
    projectAspectRatio: '16:9',
    activeShotListId: 'shot_list_hook',
    activeShotList: shotList(),
    storyboardImagesByShotId: {
      shot_001: storyboardImage('asset_001', 'file_001', '/storyboards/shot-001.png'),
      shot_002: storyboardImage('asset_002', 'file_002', '/storyboards/shot-002.png'),
    },
    castMemberLabels: {},
    castMemberImages: {},
    locationLabels: {},
  };
}

function storyboardImage(assetId: string, assetFileId: string, url: string) {
  return {
    assetId,
    assetFileId,
    relationshipId: `${assetId}_relationship`,
    title: 'Storyboard image',
    fileRole: 'image',
    mediaKind: 'image',
    mimeType: 'image/png',
    width: 1280,
    height: 720,
    url,
  };
}

function take(
  overrides: Partial<SceneShotVideoTake> = {}
): SceneShotVideoTake {
  return {
    takeId: 'take_map',
    sceneId: 'scene_hook',
    sourceShotListId: 'shot_list_hook',
    shotIds: ['shot_001'],
    title: 'Map study take',
    picked: false,
    state: emptyTakeState(),
    createdAt: '2026-06-18T09:00:00.000Z',
    updatedAt: '2026-06-18T09:00:00.000Z',
    status: {
      editability: {
        state: 'editable',
        diagnostics: [],
        message: 'This take is editable.',
      },
      resolvability: {
        state: 'resolvable',
        diagnostics: [],
        message: 'All tracked take references resolve.',
      },
      runnability: {
        state: 'not-evaluated',
        diagnostics: [],
        message: 'Run readiness is evaluated by shot-video preflight.',
      },
      archive: { state: 'active', message: 'This take is active.' },
      history: {
        differences: [],
        message: 'This take matches its recorded history snapshot.',
      },
    },
    ...overrides,
  };
}

function emptyTakeState() {
  return {
    version: 1 as const,
    shotDesignByShotId: {},
    referenceSelections: {
      dependencyInclusions: {},
      selectedCharacterSheetAssetIds: {},
      selectedLocationSheetAssetIds: {},
      selectedLocationViewIds: {},
      selectedLookbookSheetIds: [],
      selectedDialogueAudioTakeIds: {},
    },
    production: {},
  };
}
