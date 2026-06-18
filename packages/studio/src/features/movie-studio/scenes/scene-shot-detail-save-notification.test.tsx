// @vitest-environment jsdom
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  SceneShot,
  SceneShotVideoTake,
} from '@gorenku/studio-core/client';
import type { UseShotVideoTakeProductionResult } from './use-shot-video-take-production';
import { useShotVideoTakeProduction } from './use-shot-video-take-production';
import { SceneShotDetail } from './scene-shot-detail';

vi.mock('./use-shot-video-take-production', () => ({
  useShotVideoTakeProduction: vi.fn(),
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

function productionResult(
  autosave: UseShotVideoTakeProductionResult['autosave']
): UseShotVideoTakeProductionResult {
  return {
    loadState: 'ready',
    loadError: null,
    context: null,
    models: null,
    take: TAKE,
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
    refreshProductionPlan: vi.fn(async () => {}),
    reuseInput: vi.fn(async () => {}),
    regenerateInput: vi.fn(async () => {}),
    deleteInput: vi.fn(async () => {}),
  };
}

describe('SceneShotDetail save notifications', () => {
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
        label='Shot 1'
        activeTab='ai-production'
        castMemberLabels={{}}
        locationLabels={{}}
        onSaveNotificationChange={onSaveNotificationChange}
      />
    );

    expect(onSaveNotificationChange).toHaveBeenCalledTimes(1);
  });
});
