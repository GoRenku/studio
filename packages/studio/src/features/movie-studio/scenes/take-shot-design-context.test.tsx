// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  SceneShot,
  SceneShotVideoTake,
  SceneShotVideoTakeDirection,
} from '@gorenku/studio-core/client';
import {
  setShotVideoTakeDirection,
  type SceneShotVideoTakeWithHttp,
  type ShotVideoTakeWorkspaceMutation,
} from '@/services/studio-shot-video-takes-api';
import { Button } from '@/ui/button';
import {
  TakeShotDesignProvider,
  useTakeShotDesignContext,
} from './take-shot-design-context';

vi.mock('@/services/studio-shot-video-takes-api', () => ({
  setShotVideoTakeDirection: vi.fn(),
}));

const SHOT_2: SceneShot = {
  shotId: 'shot_002',
  title: 'Reaction',
  storyBeat: 'Urban catches the counter move.',
  narrativePurpose: 'Show the second angle in the grouped take.',
  description: 'Urban looks away from the gate.',
  shotType: 'Medium Close-Up',
  subject: 'Urban',
  action: 'Urban turns sharply.',
  dialogue: [],
  coveredBlockIndexes: [0],
  castMemberIds: [],
  locationIds: [],
};

describe('TakeShotDesignProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(setShotVideoTakeDirection).mockReset();
    vi.mocked(setShotVideoTakeDirection).mockResolvedValue(
      savedMutation(continuousTake())
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resets local direction state when a multi-cut take collapses to continuous', async () => {
    const multiCut = multiCutTake();
    const continuous = continuousTake();
    const { rerender } = renderProvider(multiCut);

    expect(screen.getByTestId('shot-size').textContent).toBe('wide-shot');

    rerender(renderProviderElement(continuous));

    expect(screen.getByTestId('shot-size').textContent).toBe('close-up');

    fireEvent.click(screen.getByRole('button', { name: 'Set high angle' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });

    expect(setShotVideoTakeDirection).toHaveBeenCalledWith(
      'constantinople',
      'scene_test',
      'take_001',
      {
        composition: {
          shotSize: 'close-up',
          cameraAngle: 'high-angle',
        },
      },
      undefined
    );
  });
});

function DirectionEditor() {
  const { shotDesign, update } = useTakeShotDesignContext();
  const setHighAngle = () => {
    const direction: SceneShotVideoTakeDirection = {
      ...shotDesign,
      composition: {
        ...shotDesign.composition,
        cameraAngle: 'high-angle',
      },
    };
    update(direction);
  };

  return (
    <>
      <div data-testid='shot-size'>
        {shotDesign.composition?.shotSize ?? 'none'}
      </div>
      <Button type='button' onClick={setHighAngle}>
        Set high angle
      </Button>
    </>
  );
}

function renderProvider(take: SceneShotVideoTakeWithHttp) {
  return render(renderProviderElement(take));
}

function renderProviderElement(take: SceneShotVideoTakeWithHttp) {
  return (
    <TakeShotDesignProvider
      projectName='constantinople'
      sceneId='scene_test'
      shot={SHOT_2}
      take={take}
    >
      <DirectionEditor />
    </TakeShotDesignProvider>
  );
}

function multiCutTake(): SceneShotVideoTakeWithHttp {
  return takeWithStructure({
    mode: 'multi-cut',
    directionsByShotId: {
      shot_001: { composition: { shotSize: 'close-up' } },
      shot_002: { composition: { shotSize: 'wide-shot' } },
    },
  });
}

function continuousTake(): SceneShotVideoTakeWithHttp {
  return takeWithStructure({
    mode: 'continuous',
    sharedDirection: { composition: { shotSize: 'close-up' } },
  });
}

function takeWithStructure(
  structure: SceneShotVideoTake['state']['structure']
): SceneShotVideoTakeWithHttp {
  return {
    takeId: 'take_001',
    sceneId: 'scene_test',
    sourceShotListId: 'shot_list_test',
    title: 'Gate pressure',
    shotIds: ['shot_001', 'shot_002'],
    picked: false,
    video: null,
    state: {
      version: 3,
      structure,
    },
    status: {
      editability: {
        state: 'editable',
        diagnostics: [],
        message: 'Editable.',
      },
      resolvability: {
        state: 'resolvable',
        diagnostics: [],
        message: 'Resolvable.',
      },
      archive: {
        state: 'active',
        message: 'Active.',
      },
      history: {
        differences: [],
        message: 'Current.',
      },
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function savedMutation(
  take: SceneShotVideoTake
): ShotVideoTakeWorkspaceMutation {
  return {
    workspace: {
      take,
      project: {
        id: 'project_test',
        name: 'constantinople',
        title: 'Constantinople',
        aspectRatio: '16:9',
      },
      scene: {
        id: 'scene_test',
        title: 'Opening',
        setting: { location: 'Gate', timeOfDay: 'NIGHT' },
        storyFunction: [],
      },
      shotList: {
        id: 'shot_list_test',
        title: 'Opening coverage',
        summary: 'Coverage.',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        isActive: true,
      },
      shots: [],
      storyboardImages: [],
      resourceKeys: [],
    },
    resourceKeys: [],
  } as unknown as ShotVideoTakeWorkspaceMutation;
}
