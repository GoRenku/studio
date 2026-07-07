// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  type SceneShotVideoTakeWithHttp,
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

  it('renders a take video preview before storyboard imagery when video exists', async () => {
    vi.mocked(listSceneShotVideoTakes).mockResolvedValue({
      takes: [
        takeOverview(
          take({
            takeId: 'take_video',
            title: 'Video take',
            shotIds: ['shot_001'],
            video: {
              takeId: 'take_video',
              assetId: 'asset_video',
              assetFileId: 'asset_file_video',
              projectRelativePath:
                'generated/media/final-take.mp4' as ProjectRelativePath,
              mimeType: 'video/mp4',
              createdAt: '2026-06-18T12:00:00.000Z',
              url: '/studio-api/projects/constantinople/screenplay/scenes/scene_hook/takes/take_video/video/files/asset_file_video',
            } as never,
          })
        ),
      ],
    });

    render(<SceneTakesTabHarness />);

    const video = await screen.findByTitle('Map study');
    expect(video.tagName).toBe('VIDEO');
    expect(
      screen.queryByRole('img', { name: 'Storyboard image for Shot 1' })
    ).toBeNull();
  });

  it('plays finalized take card videos on hover and keyboard focus', async () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockResolvedValue(undefined);
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, 'pause')
      .mockImplementation(() => {});
    vi.mocked(listSceneShotVideoTakes).mockResolvedValue({
      takes: [
        takeOverview(
          take({
            takeId: 'take_video',
            title: 'Video take',
            shotIds: ['shot_001'],
            video: {
              takeId: 'take_video',
              assetId: 'asset_video',
              assetFileId: 'asset_file_video',
              projectRelativePath:
                'generated/media/final-take.mp4' as ProjectRelativePath,
              mimeType: 'video/mp4',
              createdAt: '2026-06-18T12:00:00.000Z',
              url: '/studio-api/projects/constantinople/screenplay/scenes/scene_hook/takes/take_video/video/files/asset_file_video',
            } as never,
          })
        ),
      ],
    });

    try {
      render(<SceneTakesTabHarness />);

      const card = await screen.findByRole('button', { name: 'Map study' });
      const video = screen.getByTitle('Map study') as HTMLVideoElement;
      play.mockClear();
      pause.mockClear();

      fireEvent.pointerEnter(card);
      await waitFor(() => expect(play).toHaveBeenCalledTimes(1));

      Object.defineProperty(video, 'paused', {
        configurable: true,
        value: false,
      });
      fireEvent.pointerLeave(card);
      expect(pause).toHaveBeenCalled();
      expect(video.currentTime).toBe(0);

      play.mockClear();
      pause.mockClear();
      fireEvent.focus(card);
      await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
      Object.defineProperty(video, 'paused', {
        configurable: true,
        value: false,
      });
      fireEvent.blur(card);
      expect(pause).toHaveBeenCalled();
      expect(video.currentTime).toBe(0);
    } finally {
      play.mockRestore();
      pause.mockRestore();
    }
  });

  it('uses overview shot ids for read-only take card storyboard previews', async () => {
    vi.mocked(listSceneShotVideoTakes).mockResolvedValue({
      takes: [
        takeOverview(
          take({
            takeId: 'take_broken_membership',
            title: 'Broken membership take',
            shotIds: [],
            status: readOnlyTakeStatus(),
          }),
          {
            overviewShotIds: ['shot_001'],
          }
        ),
      ],
    });

    render(<SceneTakesTabHarness />);

    const image = await screen.findByRole('img', {
      name: 'Storyboard image for Shot 1',
    });
    expect(image.getAttribute('src')).toBe('/storyboards/shot-001.png');
    expect(screen.getByText('Shot 1')).not.toBeNull();
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
      <span data-testid='selection-take-id'>{selection.takeId ?? ''}</span>
      <span data-testid='selection-shot-id'>{selection.shotId ?? ''}</span>
      <span data-testid='selection-shot-tab'>{selection.shotTab ?? ''}</span>
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
  take: SceneShotVideoTakeWithHttp;
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

function takeOverview(
  value: SceneShotVideoTakeWithHttp,
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
    overviewShotIds: [...value.shotIds],
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

function takeCreateReport(value: SceneShotVideoTakeWithHttp) {
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
  overrides: Partial<SceneShotVideoTakeWithHttp> = {}
): SceneShotVideoTakeWithHttp {
  return {
    takeId: 'take_map',
    sceneId: 'scene_hook',
    sourceShotListId: 'shot_list_hook',
    shotIds: ['shot_001'],
    title: 'Map study take',
    picked: false,
    video: null,
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

function readOnlyTakeStatus(): SceneShotVideoTake['status'] {
  return {
    editability: {
      state: 'read-only',
      diagnostics: [
        {
          code: 'CORE_SHOT_VIDEO_TAKE_STRUCTURE_MISSING_SHOT_MEMBERSHIP',
          message: 'Shot video take state must have at least one grouped shot.',
          severity: 'error',
          location: { path: ['take', 'shotIds'] },
          suggestion:
            'Repair the take shot membership before editing or generating from this take.',
        },
      ],
      message: 'This take needs shot structure repair before editing.',
    },
    resolvability: {
      state: 'missing-references',
      diagnostics: [],
      message: 'This take has invalid shot structure.',
    },
    runnability: {
      state: 'blocked',
      diagnostics: [],
      message: 'Repair this take shot structure before generation.',
    },
    archive: { state: 'active', message: 'This take is active.' },
    history: {
      differences: [],
      message: 'This take matches its recorded history snapshot.',
    },
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
          selectedLocationSheetAssetIds: {},
          selectedLookbookSheetIds: [],
          selectedDialogueAudioTakeIds: {},
        },
      },
    },
    production: {},
  };
}
