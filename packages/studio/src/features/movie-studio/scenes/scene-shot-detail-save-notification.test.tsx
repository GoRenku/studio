// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  SceneShot,
} from '@gorenku/studio-core/client';
import { setShotVideoTakeStructure } from '@/services/studio-shot-video-takes-api';
import type { SceneShotVideoTakeWithHttp } from '@/services/studio-shot-video-takes-api';
import type { UseShotVideoTakeProductionResult } from './use-shot-video-take-production';
import { useShotVideoTakeProduction } from './use-shot-video-take-production';
import { SceneShotDetail } from './scene-shot-detail';

vi.mock('./use-shot-video-take-production', () => ({
  useShotVideoTakeProduction: vi.fn(),
}));

vi.mock('@/services/studio-shot-video-takes-api', () => ({
  setShotVideoTakeStructure: vi.fn(),
}));

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= ResizeObserverStub;

const SHOT: SceneShot = {
  shotId: 'shot_001',
  title: 'Map study',
  storyBeat: '',
  narrativePurpose: '',
  description: '',
  shotType: 'wide',
  subject: '',
  action: '',
  dialogue: [],
  coveredBlockIndexes: [],
  castMemberIds: [],
  locationIds: [],
};

const TAKE: SceneShotVideoTakeWithHttp = {
  takeId: 'take_001',
  sceneId: 'scene_hook',
  sourceShotListId: 'shot_list_hook',
  shotIds: ['shot_001'],
  title: 'Shot 1 Shot Video Take',
  picked: false,
  video: null,
  state: emptyTakeState(),
  createdAt: '',
  updatedAt: '',
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
      archive: { state: 'active', message: 'This take is active.' },
      history: { differences: [], message: 'This take matches its recorded history snapshot.' },
    },
};

const GROUPED_TAKE: SceneShotVideoTakeWithHttp = {
  ...TAKE,
  shotIds: ['shot_001', 'shot_002'],
  title: 'Two Shot Video Take',
};

const MULTI_CUT_TAKE: SceneShotVideoTakeWithHttp = {
  ...GROUPED_TAKE,
  state: {
    version: 3,
    structure: {
      mode: 'multi-cut',
      directionsByShotId: {
        shot_001: {
          composition: { shotSize: 'wide-shot' },
        },
        shot_002: {
          composition: { shotSize: 'close-up' },
        },
      },
    },
  },
};

function emptyTakeState() {
  return {
    version: 3 as const,
    structure: {
      mode: 'continuous' as const,
      sharedDirection: {},
    },
  };
}

function productionResult(
  autosave: Omit<
    UseShotVideoTakeProductionResult['autosave'],
    'flushPending'
  > &
    Partial<Pick<UseShotVideoTakeProductionResult['autosave'], 'flushPending'>>,
  take = TAKE,
  refreshWorkspace = vi.fn(async () => {})
): UseShotVideoTakeProductionResult {
  return {
    loadState: 'ready',
    loadError: null,
    workspace: null,
    models: null,
    take,
    isEditable: true,
    selectedInputMode: null,
    selectedModel: undefined,
    setup: null,
    setInputMode: vi.fn(),
    setModel: vi.fn(),
    setParameter: vi.fn(),
    autosave: {
      flushPending: async () => true,
      ...autosave,
    },
    estimate: null,
    estimateState: 'idle',
    estimateError: null,
    refreshWorkspace,
    setReferenceIncluded: vi.fn(async () => {}),
  };
}

describe('SceneShotDetail save notifications', () => {
  beforeEach(() => {
    vi.mocked(useShotVideoTakeProduction).mockReset();
    vi.mocked(setShotVideoTakeStructure).mockReset();
  });

  it('routes AI Production autosave status to the details header path', async () => {
    vi.mocked(useShotVideoTakeProduction).mockReturnValue(
      productionResult({ state: 'saved', message: 'Saved' })
    );
    const onSaveNotificationChange = vi.fn();

    render(
      <SceneShotDetail
        projectName='constantinople'
        sceneId='scene_hook'
        shot={SHOT}
        take={TAKE}
        isShotEditable
        label='Shot 1'
        activeTab='ai-production'
        castMemberLabels={{}}
        locationLabels={{}}
        onSaveNotificationChange={onSaveNotificationChange}
      />
    );

    await waitFor(() => {
      expect(onSaveNotificationChange).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'saved',
          message: 'Saved',
        })
      );
    });
  });

  it('does not report unchanged autosave status again after a rerender', async () => {
    vi.mocked(useShotVideoTakeProduction).mockImplementation(() =>
      productionResult({ state: 'idle', message: null })
    );
    const onSaveNotificationChange = vi.fn();

    const { rerender } = render(
      <SceneShotDetail
        projectName='constantinople'
        sceneId='scene_hook'
        shot={SHOT}
        take={TAKE}
        isShotEditable
        label='Shot 1'
        activeTab='ai-production'
        castMemberLabels={{}}
        locationLabels={{}}
        onSaveNotificationChange={onSaveNotificationChange}
      />
    );

    await waitFor(() => {
      expect(onSaveNotificationChange).toHaveBeenCalledTimes(1);
    });

    rerender(
      <SceneShotDetail
        projectName='constantinople'
        sceneId='scene_hook'
        shot={SHOT}
        take={TAKE}
        isShotEditable
        label='Shot 1'
        activeTab='ai-production'
        castMemberLabels={{}}
        locationLabels={{}}
        onSaveNotificationChange={onSaveNotificationChange}
      />
    );

    expect(onSaveNotificationChange).toHaveBeenCalledTimes(1);
  });

  it('shows the structure toggle beside grouped takes and delegates mode changes', async () => {
    const refreshWorkspace = vi.fn(async () => {});
    vi.mocked(useShotVideoTakeProduction).mockReturnValue(
      productionResult(
        { state: 'idle', message: null },
        GROUPED_TAKE,
        refreshWorkspace
      )
    );
    vi.mocked(setShotVideoTakeStructure).mockResolvedValue({
      workspace: {
        take: {
          ...GROUPED_TAKE,
          state: {
            ...GROUPED_TAKE.state,
            structure: {
              mode: 'multi-cut',
              directionsByShotId: {
                shot_001: {},
                shot_002: {},
              },
            },
          },
        },
      },
      resourceKeys: [],
    } as never);
    const onTakeMutation = vi.fn();

    render(
      <SceneShotDetail
        projectName='constantinople'
        sceneId='scene_hook'
        shot={SHOT}
        take={GROUPED_TAKE}
        isShotEditable
        label='Shot 1'
        activeTab='description'
        castMemberLabels={{}}
        locationLabels={{}}
        onTakeMutation={onTakeMutation}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Continuous Move' })
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Multi-Cut Sequence' }));

    await waitFor(() => {
      expect(setShotVideoTakeStructure).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        'take_001',
        'multi-cut',
        undefined
      );
    });
    expect(refreshWorkspace).toHaveBeenCalledOnce();
    expect(onTakeMutation).toHaveBeenCalledOnce();
  });

  it('asks for a source shot when collapsing divergent multi-cut directions', async () => {
    vi.mocked(useShotVideoTakeProduction).mockReturnValue(
      productionResult({ state: 'idle', message: null }, MULTI_CUT_TAKE)
    );
    vi.mocked(setShotVideoTakeStructure)
      .mockRejectedValueOnce(
        new Error('CORE_SHOT_VIDEO_TAKE_STRUCTURE_MISSING_SOURCE_SHOT')
      )
      .mockResolvedValueOnce({
        workspace: {
          take: {
            ...MULTI_CUT_TAKE,
            state: {
              ...MULTI_CUT_TAKE.state,
              structure: {
                mode: 'continuous',
                sharedDirection: {
                  composition: { shotSize: 'close-up' },
                },
              },
            },
          },
        },
        resourceKeys: [],
      } as never);

    render(
      <SceneShotDetail
        projectName='constantinople'
        sceneId='scene_hook'
        shot={SHOT}
        take={MULTI_CUT_TAKE}
        isShotEditable
        label='Shot 1'
        activeTab='description'
        castMemberLabels={{}}
        locationLabels={{}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Continuous Move' }));

    expect(
      await screen.findByText(
        /Choose which shot should become the shared Continuous Move direction/
      )
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Use Shot 2' }));

    await waitFor(() => {
      expect(setShotVideoTakeStructure).toHaveBeenLastCalledWith(
        'constantinople',
        'scene_hook',
        'take_001',
        'continuous',
        'shot_002'
      );
    });
  });
});
