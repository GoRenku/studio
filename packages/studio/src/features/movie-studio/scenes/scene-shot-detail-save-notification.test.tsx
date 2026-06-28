// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  SceneShot,
  SceneShotVideoTake,
} from '@gorenku/studio-core/client';
import { updateSceneShotVideoTakeStructureMode } from '@/services/studio-shot-video-takes-api';
import type { UseShotVideoTakeProductionResult } from './use-shot-video-take-production';
import { useShotVideoTakeProduction } from './use-shot-video-take-production';
import { SceneShotDetail } from './scene-shot-detail';

vi.mock('./use-shot-video-take-production', () => ({
  useShotVideoTakeProduction: vi.fn(),
}));

vi.mock('@/services/studio-shot-video-takes-api', () => ({
  updateSceneShotVideoTakeStructureMode: vi.fn(),
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

const TAKE: SceneShotVideoTake = {
  takeId: 'take_001',
  sceneId: 'scene_hook',
  sourceShotListId: 'shot_list_hook',
  shotIds: ['shot_001'],
  title: 'Shot 1 Shot Video Take',
  picked: false,
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
      runnability: {
        state: 'not-evaluated',
        diagnostics: [],
        message: 'Run readiness is evaluated by shot-video preflight.',
      },
      archive: { state: 'active', message: 'This take is active.' },
      history: { differences: [], message: 'This take matches its recorded history snapshot.' },
    },
};

const GROUPED_TAKE: SceneShotVideoTake = {
  ...TAKE,
  shotIds: ['shot_001', 'shot_002'],
  title: 'Two Shot Video Take',
};

const MULTI_CUT_TAKE: SceneShotVideoTake = {
  ...GROUPED_TAKE,
  state: {
    version: 2,
    structure: {
      mode: 'multi-cut',
      directionsByShotId: {
        shot_001: {
          composition: { shotSize: 'wide-shot' },
          referenceSelections: emptyReferenceSelections(),
        },
        shot_002: {
          composition: { shotSize: 'close-up' },
          referenceSelections: emptyReferenceSelections(),
        },
      },
    },
    production: {},
  },
};

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

function emptyReferenceSelections() {
  return {
    dependencyInclusions: {},
    selectedCharacterSheetAssetIds: {},
    selectedLocationSheetAssetIds: {},
    selectedLookbookSheetIds: [],
    selectedDialogueAudioTakeIds: {},
  };
}

function productionResult(
  autosave: UseShotVideoTakeProductionResult['autosave'],
  take = TAKE,
  refreshProductionPlan = vi.fn(async () => {})
): UseShotVideoTakeProductionResult {
  return {
    loadState: 'ready',
    loadError: null,
    context: null,
    models: null,
    take,
    isEditable: true,
    selectedInputMode: null,
    selectedModel: undefined,
    setInputMode: vi.fn(),
    setModel: vi.fn(),
    setParameter: vi.fn(),
    autosave,
    productionPlan: null,
    estimate: null,
    estimateState: 'idle',
    estimateError: null,
    planState: 'idle',
    planError: null,
    refreshProductionPlan,
    reuseInput: vi.fn(async () => {}),
    regenerateInput: vi.fn(async () => {}),
    deleteInput: vi.fn(async () => {}),
  };
}

describe('SceneShotDetail save notifications', () => {
  beforeEach(() => {
    vi.mocked(useShotVideoTakeProduction).mockReset();
    vi.mocked(updateSceneShotVideoTakeStructureMode).mockReset();
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
      expect(onSaveNotificationChange).toHaveBeenCalledWith({
        state: 'saved',
        message: 'Saved',
      });
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
    const refreshProductionPlan = vi.fn(async () => {});
    vi.mocked(useShotVideoTakeProduction).mockReturnValue(
      productionResult(
        { state: 'idle', message: null },
        GROUPED_TAKE,
        refreshProductionPlan
      )
    );
    vi.mocked(updateSceneShotVideoTakeStructureMode).mockResolvedValue({
      context: {
        take: {
          ...GROUPED_TAKE,
          state: {
            ...GROUPED_TAKE.state,
            structure: {
              mode: 'multi-cut',
              directionsByShotId: {
                shot_001: { referenceSelections: emptyReferenceSelections() },
                shot_002: { referenceSelections: emptyReferenceSelections() },
              },
            },
          },
        },
      },
      resourceKeys: [],
    } as never);
    const onTakeChange = vi.fn();

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
        onTakeChange={onTakeChange}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Continuous Move' })
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Multi-Cut Sequence' }));

    await waitFor(() => {
      expect(updateSceneShotVideoTakeStructureMode).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        'take_001',
        'multi-cut',
        undefined
      );
    });
    expect(refreshProductionPlan).toHaveBeenCalledOnce();
    expect(onTakeChange).toHaveBeenCalledOnce();
  });

  it('asks for a source shot when collapsing divergent multi-cut directions', async () => {
    vi.mocked(useShotVideoTakeProduction).mockReturnValue(
      productionResult({ state: 'idle', message: null }, MULTI_CUT_TAKE)
    );
    vi.mocked(updateSceneShotVideoTakeStructureMode)
      .mockRejectedValueOnce(
        new Error('CORE_SHOT_VIDEO_TAKE_STRUCTURE_MISSING_SOURCE_SHOT')
      )
      .mockResolvedValueOnce({
        context: {
          take: {
            ...MULTI_CUT_TAKE,
            state: {
              ...MULTI_CUT_TAKE.state,
              structure: {
                mode: 'continuous',
                sharedDirection: {
                  composition: { shotSize: 'close-up' },
                  referenceSelections: emptyReferenceSelections(),
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
      expect(updateSceneShotVideoTakeStructureMode).toHaveBeenLastCalledWith(
        'constantinople',
        'scene_hook',
        'take_001',
        'continuous',
        'shot_002'
      );
    });
  });
});
