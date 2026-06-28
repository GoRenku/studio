// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ProjectRelativePath,
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
  readSceneShotVideoTakeEditContext,
  type SceneShotVideoTakeEditContextResponse,
  type SceneShotVideoTakeOverviewResponse,
  type ShotVideoTakeProductionContextResponse,
  type ShotVideoTakeStoryboardImageReferenceWithHttp,
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
  readSceneShotVideoTakeEditContext: vi.fn(),
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

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= ResizeObserverStub;

describe('SceneTakesTab', () => {
  beforeEach(() => {
    vi.mocked(readSceneShotListResource).mockReset();
    vi.mocked(readSceneShotListResource).mockResolvedValue(resource());
    vi.mocked(listSceneShotVideoTakes).mockReset();
    vi.mocked(listSceneShotVideoTakes).mockResolvedValue({
      takes: [
        takeOverview(
          take({
            takeId: 'take_reaction',
            title: 'Reaction take',
            shotIds: ['shot_002'],
            updatedAt: '2026-06-18T11:00:00.000Z',
          })
        ),
        takeOverview(
          take({
            takeId: 'take_map',
            title: 'Map study take',
            shotIds: ['shot_001'],
            updatedAt: '2026-06-18T10:00:00.000Z',
          })
        ),
      ],
    });
    vi.mocked(createSceneShotVideoTake).mockReset();
    vi.mocked(createSceneShotVideoTake).mockResolvedValue(
      takeCreateReport(take())
    );
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
    vi.mocked(readSceneShotVideoTakeEditContext).mockReset();
    vi.mocked(readSceneShotVideoTakeEditContext).mockResolvedValue(
      takeEditContext({
        take: take({
          takeId: 'take_reaction',
          title: 'Reaction take',
          shotIds: ['shot_002'],
          updatedAt: '2026-06-18T11:00:00.000Z',
        }),
        sourceShotListId: 'shot_list_hook',
        displayShots: shotList().shots,
      })
    );
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

  it('keeps the storyboard preview on a locally created take card', async () => {
    const createdTake = take({
      takeId: 'take_created',
      title: 'Map study take',
      shotIds: ['shot_001'],
      updatedAt: '2026-06-18T12:00:00.000Z',
    });
    vi.mocked(listSceneShotVideoTakes).mockResolvedValue({ takes: [] });
    vi.mocked(createSceneShotVideoTake).mockResolvedValue(
      takeCreateReport(createdTake)
    );

    render(<SceneTakesTabHarness />);

    fireEvent.click(await screen.findByRole('button', { name: 'New Take' }));

    await waitFor(() =>
      expect(createSceneShotVideoTake).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        {
          shotListId: 'shot_list_hook',
          shotIds: ['shot_001'],
          title: 'Map study',
        }
      )
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Close take workspace' })
    );

    const image = await screen.findByRole('img', {
      name: 'Storyboard image for Shot 1',
    });
    expect(image.getAttribute('src')).toBe('/storyboards/shot-001.png');
  });

  it('ignores repeated New Take clicks while creation is pending', async () => {
    const createdTake = take({
      takeId: 'take_created',
      title: 'Map study take',
      shotIds: ['shot_001'],
      updatedAt: '2026-06-18T12:00:00.000Z',
    });
    let resolveCreate!: (report: ReturnType<typeof takeCreateReport>) => void;
    vi.mocked(listSceneShotVideoTakes).mockResolvedValue({ takes: [] });
    vi.mocked(createSceneShotVideoTake).mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      })
    );

    render(<SceneTakesTabHarness />);

    const createButton = await screen.findByRole('button', { name: 'New Take' });
    fireEvent.click(createButton);
    fireEvent.click(createButton);

    expect(createSceneShotVideoTake).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCreate(takeCreateReport(createdTake));
    });
    await screen.findByRole('button', { name: 'Close take workspace' });
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

  it('selects shots for an existing take against its source shot list after the active shot list changes', async () => {
    const sourceTake = take({
      takeId: 'take_reaction',
      title: 'Reaction take',
      sourceShotListId: 'shot_list_source',
      shotIds: ['shot_002'],
      updatedAt: '2026-06-18T11:00:00.000Z',
    });
    const sourceShots = shotList().shots;
    const activeShots = [
      shot('shot_001', 'Map study'),
      shot('shot_001b', 'Inserted wall crossing'),
      shot('shot_002', 'Council reaction'),
    ];

    vi.mocked(readSceneShotListResource).mockResolvedValue({
      ...resource(),
      activeShotListId: 'shot_list_expanded',
      activeShotList: {
        ...shotList(),
        summary: 'Three shots.',
        shots: activeShots,
      },
      storyboardImagesByShotId: {
        shot_001: storyboardImage(
          'asset_001',
          'file_001',
          '/storyboards/shot-001.png'
        ),
        shot_001b: storyboardImage(
          'asset_001b',
          'file_001b',
          '/storyboards/shot-001b.png'
        ),
        shot_002: storyboardImage(
          'asset_002',
          'file_002',
          '/storyboards/shot-002.png'
        ),
      },
    });
    vi.mocked(listSceneShotVideoTakes).mockResolvedValue({
      takes: [
        takeOverview(sourceTake, {
          displayShots: sourceShots,
          storyboardImages: [
            sourceStoryboardImage(
              'shot_001',
              'asset_old_001',
              'file_old_001',
              '/storyboards/source-shot-001.png'
            ),
            sourceStoryboardImage(
              'shot_002',
              'asset_old_002',
              'file_old_002',
              '/storyboards/source-shot-002.png'
            ),
          ],
        }),
      ],
    });
    vi.mocked(readSceneShotVideoTakeEditContext).mockResolvedValue(
      takeEditContext({
        take: sourceTake,
        sourceShotListId: 'shot_list_source',
        displayShots: sourceShots,
        storyboardImages: [
          sourceStoryboardImage(
            'shot_001',
            'asset_old_001',
            'file_old_001',
            '/storyboards/source-shot-001.png'
          ),
          sourceStoryboardImage(
            'shot_002',
            'asset_old_002',
            'file_old_002',
            '/storyboards/source-shot-002.png'
          ),
        ],
      })
    );
    vi.mocked(updateSceneShotVideoTakeShots).mockResolvedValue({
      context: takeProductionContext({
        take: {
          ...sourceTake,
          shotIds: ['shot_001', 'shot_002'],
          updatedAt: '2026-06-18T12:00:00.000Z',
        },
        shotListId: 'shot_list_source',
        displayShots: sourceShots,
        storyboardImages: [
          sourceStoryboardImage(
            'shot_001',
            'asset_old_001',
            'file_old_001',
            '/storyboards/source-shot-001.png'
          ),
          sourceStoryboardImage(
            'shot_002',
            'asset_old_002',
            'file_old_002',
            '/storyboards/source-shot-002.png'
          ),
        ],
      }),
      resourceKeys: [],
    });

    render(
      <SceneTakesTabHarness
        initialSelection={{
          type: 'scene',
          id: 'scene_hook',
          sceneTab: 'takes',
          takeWorkspaceMode: 'edit',
          takeId: 'take_reaction',
          shotId: 'shot_002',
        }}
      />
    );

    expect(
      await screen.findByRole('button', { name: /Shot 1.*Map study/ })
    ).not.toBeNull();
    expect(
      screen.getByRole('button', { name: /Shot 2.*Council reaction/ })
    ).not.toBeNull();
    expect(screen.queryByText('Inserted wall crossing')).toBeNull();
    expect(
      screen
        .getByRole('img', { name: 'Shot 1 — Map study' })
        .getAttribute('src')
    ).toBe('/storyboards/source-shot-001.png');

    fireEvent.click(
      screen.getByRole('button', { name: 'Expand Select for Shot 1' })
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Mode' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() =>
      expect(updateSceneShotVideoTakeShots).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        'take_reaction',
        ['shot_001', 'shot_002']
      )
    );
  });

  it('replaces the selected take shots when a non-contiguous shot is selected', async () => {
    configureFiveShotEditTake(['shot_001', 'shot_002', 'shot_003']);

    render(
      <SceneTakesTabHarness
        initialSelection={{
          type: 'scene',
          id: 'scene_hook',
          sceneTab: 'takes',
          takeWorkspaceMode: 'edit',
          takeId: 'take_reaction',
          shotId: 'shot_003',
        }}
      />
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Select Shot for Shot 5' })
    );

    expect(selectedForEditLabels()).toEqual(['Shot 5 — The machine is fed']);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Mode' }));
    expect(
      screen.getByText('Deselect Shot 1-3 and select Shot 5.')
    ).not.toBeNull();
    expect(screen.getByText('1 prompt draft will be refreshed.')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() =>
      expect(updateSceneShotVideoTakeShots).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        'take_reaction',
        ['shot_005']
      )
    );
  });

  it('deselects an interior shot without keeping later shots selected', async () => {
    configureFiveShotEditTake([
      'shot_001',
      'shot_002',
      'shot_003',
      'shot_004',
    ]);

    render(
      <SceneTakesTabHarness
        initialSelection={{
          type: 'scene',
          id: 'scene_hook',
          sceneTab: 'takes',
          takeWorkspaceMode: 'edit',
          takeId: 'take_reaction',
          shotId: 'shot_003',
        }}
      />
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Stop Select for Shot 3' })
    );

    expect(selectedForEditLabels()).toEqual([
      'Shot 1 — Walls in smoke',
      'Shot 2 — Bronze mouth',
    ]);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Mode' }));
    expect(
      screen.getByText('Change selection from Shot 1-4 to Shot 1-2.')
    ).not.toBeNull();
    expect(screen.queryByText('Select Shot 4.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() =>
      expect(updateSceneShotVideoTakeShots).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        'take_reaction',
        ['shot_001', 'shot_002']
      )
    );
  });

  it('keeps only the new shot after deselecting bottom then top edge shots', async () => {
    configureFiveShotEditTake(['shot_001', 'shot_002']);

    render(
      <SceneTakesTabHarness
        initialSelection={{
          type: 'scene',
          id: 'scene_hook',
          sceneTab: 'takes',
          takeWorkspaceMode: 'edit',
          takeId: 'take_reaction',
          shotId: 'shot_002',
        }}
      />
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Stop Select for Shot 2' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Stop Select for Shot 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select Shot for Shot 4' }));

    expect(selectedForEditLabels()).toEqual([
      'Shot 4 — Mara and Urban divided by bronze',
    ]);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Mode' }));
    expect(
      screen.getByText('Deselect Shot 1-2 and select Shot 4.')
    ).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() =>
      expect(updateSceneShotVideoTakeShots).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        'take_reaction',
        ['shot_004']
      )
    );
  });

  it('keeps only the new shot after deselecting top then remaining edge shots', async () => {
    configureFiveShotEditTake(['shot_001', 'shot_002']);

    render(
      <SceneTakesTabHarness
        initialSelection={{
          type: 'scene',
          id: 'scene_hook',
          sceneTab: 'takes',
          takeWorkspaceMode: 'edit',
          takeId: 'take_reaction',
          shotId: 'shot_001',
        }}
      />
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Stop Select for Shot 1' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Stop Select for Shot 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select Shot for Shot 4' }));

    expect(selectedForEditLabels()).toEqual([
      'Shot 4 — Mara and Urban divided by bronze',
    ]);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Mode' }));
    expect(
      screen.getByText('Deselect Shot 1-2 and select Shot 4.')
    ).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() =>
      expect(updateSceneShotVideoTakeShots).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        'take_reaction',
        ['shot_004']
      )
    );
  });

  it('shows only Description when a focused source-list shot is not selected in the open take', async () => {
    const sourceTake = take({
      takeId: 'take_reaction',
      title: 'Reaction take',
      shotIds: ['shot_002'],
      updatedAt: '2026-06-18T11:00:00.000Z',
    });

    vi.mocked(listSceneShotVideoTakes).mockResolvedValue({
      takes: [takeOverview(sourceTake)],
    });
    vi.mocked(readSceneShotVideoTakeEditContext).mockResolvedValue(
      takeEditContext({
        take: sourceTake,
        sourceShotListId: 'shot_list_hook',
        displayShots: shotList().shots,
      })
    );

    render(
      <SceneTakesTabHarness
        initialSelection={{
          type: 'scene',
          id: 'scene_hook',
          sceneTab: 'takes',
          takeWorkspaceMode: 'edit',
          takeId: 'take_reaction',
          shotId: 'shot_001',
          shotTab: 'composition',
        }}
      />
    );

    expect(await screen.findByRole('tab', { name: 'Description' })).not.toBeNull();
    expect(screen.queryByRole('tab', { name: 'Composition' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Motion' })).toBeNull();
    expect(screen.queryByText('Map study description.')).not.toBeNull();
  });
});

function SceneTakesTabHarness({
  initialSelection = {
    type: 'scene',
    id: 'scene_hook',
    sceneTab: 'takes',
  },
}: {
  initialSelection?: Extract<StudioSelection, { type: 'scene' }>;
}) {
  const [selection, setSelection] = React.useState<
    Extract<StudioSelection, { type: 'scene' }>
  >(initialSelection);
  const [headerAction, setHeaderAction] =
    React.useState<React.ReactNode | null>(null);
  const handleSelect = React.useCallback((nextSelection: StudioSelection) => {
    if (nextSelection.type === 'scene') {
      setSelection(nextSelection);
    }
  }, []);
  return (
    <>
      {headerAction}
      <SceneTakesTab
        projectName='constantinople'
        sceneId='scene_hook'
        takeWorkspaceMode={selection.takeWorkspaceMode}
        takeId={selection.takeId}
        shotId={selection.shotId}
        shotTab={selection.shotTab}
        onHeaderActionChange={setHeaderAction}
        onSelect={handleSelect}
      />
    </>
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

function fiveShotList(): SceneShotListDocument {
  return {
    kind: 'sceneShotList',
    sceneId: 'scene_hook',
    title: 'Bombardment source coverage',
    summary: 'Five shots.',
    coverageStrategy: 'Move from the wall to the machine.',
    shots: [
      shot('shot_001', 'Walls in smoke'),
      shot('shot_002', 'Bronze mouth'),
      shot('shot_003', 'Urban reads the metal'),
      shot('shot_004', 'Mara and Urban divided by bronze'),
      shot('shot_005', 'The machine is fed'),
    ],
  };
}

function configureFiveShotEditTake(shotIds: string[]) {
  const sourceShots = fiveShotList().shots;
  const sourceTake = take({
    takeId: 'take_reaction',
    title: 'Reaction take',
    sourceShotListId: 'shot_list_source',
    shotIds,
    updatedAt: '2026-06-18T11:00:00.000Z',
  });
  const storyboardImages = sourceShots.map((sourceShot, index) =>
    sourceStoryboardImage(
      sourceShot.shotId,
      `asset_old_${index + 1}`,
      `file_old_${index + 1}`,
      `/storyboards/source-shot-${index + 1}.png`
    )
  );

  vi.mocked(listSceneShotVideoTakes).mockResolvedValue({
    takes: [
      takeOverview(sourceTake, {
        displayShots: sourceShots,
        storyboardImages,
      }),
    ],
  });
  vi.mocked(readSceneShotVideoTakeEditContext).mockResolvedValue(
    takeEditContext({
      take: sourceTake,
      sourceShotListId: 'shot_list_source',
      displayShots: sourceShots,
      storyboardImages,
    })
  );
  vi.mocked(updateSceneShotVideoTakeShots).mockImplementation(
    async (_projectName, _sceneId, _takeId, nextShotIds) => ({
      context: takeProductionContext({
        take: {
          ...sourceTake,
          shotIds: nextShotIds,
          updatedAt: '2026-06-18T12:00:00.000Z',
        },
        shotListId: 'shot_list_source',
        displayShots: sourceShots,
        storyboardImages,
      }),
      resourceKeys: [],
    })
  );
}

function selectedForEditLabels(): string[] {
  return Array.from(
    document.querySelectorAll('[data-selected-for-edit="true"]')
  )
    .map((element) => element.getAttribute('aria-label'))
    .filter((label): label is string => Boolean(label));
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

function takeEditContext(input: {
  take: SceneShotVideoTake;
  sourceShotListId: string;
  displayShots: SceneShot[];
  storyboardImages?: ReturnType<typeof sourceStoryboardImage>[];
}): SceneShotVideoTakeEditContextResponse {
  return {
    take: input.take,
    sourceShotList: {
      id: input.sourceShotListId,
      title: 'Source shot list',
      summary: 'Source shot coverage.',
      createdAt: '2026-06-18T09:00:00.000Z',
      updatedAt: '2026-06-18T09:00:00.000Z',
      isActive: false,
    },
    displayShots: input.displayShots,
    storyboardImages: input.storyboardImages ?? [],
  } as unknown as SceneShotVideoTakeEditContextResponse;
}

function takeProductionContext(input: {
  take: SceneShotVideoTake;
  shotListId: string;
  displayShots: SceneShot[];
  storyboardImages?: ReturnType<typeof sourceStoryboardImage>[];
}): ShotVideoTakeProductionContextResponse {
  return {
    take: input.take,
    shotList: {
      id: input.shotListId,
      title: 'Source shot list',
      summary: 'Source shot coverage.',
      createdAt: '2026-06-18T09:00:00.000Z',
      updatedAt: '2026-06-18T09:00:00.000Z',
      isActive: false,
    },
    displayShots: input.displayShots,
    storyboardImages: input.storyboardImages ?? [],
  } as unknown as ShotVideoTakeProductionContextResponse;
}

function takeOverview(
  value: SceneShotVideoTake,
  overrides: Partial<SceneShotVideoTakeOverviewResponse> = {}
): SceneShotVideoTakeOverviewResponse {
  return {
    take: value,
    sourceShotList: {
      id: value.sourceShotListId,
      title: 'Source shot list',
      summary: 'Source shot coverage.',
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
      isActive: value.sourceShotListId === 'shot_list_hook',
    },
    displayShots: shotList().shots,
    storyboardImages: [
      sourceStoryboardImage(
        'shot_001',
        'asset_001',
        'file_001',
        '/storyboards/shot-001.png'
      ),
      sourceStoryboardImage(
        'shot_002',
        'asset_002',
        'file_002',
        '/storyboards/shot-002.png'
      ),
    ],
    ...overrides,
  };
}

function takeCreateReport(value: SceneShotVideoTake) {
  return {
    overview: takeOverview(value),
    resourceKeys: [],
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

function sourceStoryboardImage(
  shotId: string,
  assetId: string,
  assetFileId: string,
  url: string
): ShotVideoTakeStoryboardImageReferenceWithHttp {
  return {
    ...storyboardImage(assetId, assetFileId, url),
    shotId,
    projectRelativePath: `screenplay/storyboards/${shotId}.png` as ProjectRelativePath,
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
    version: 2 as const,
    structure: {
      mode: 'continuous' as const,
      sharedDirection: {
        referenceSelections: {
          dependencyInclusions: {},
          selectedCharacterSheetAssetIds: {},
          referencedLocationSheetAssetIds: {},
          selectedLookbookSheetIds: [],
          selectedDialogueAudioTakeIds: {},
        },
      },
    },
    production: {},
  };
}
