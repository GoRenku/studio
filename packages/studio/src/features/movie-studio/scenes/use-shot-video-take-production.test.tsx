// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  SceneShotVideoTake,
} from '@gorenku/studio-core/client';
import { Button } from '@/ui/button';
import {
  estimateShotVideoTakeProduction,
  planShotVideoTakeProduction,
  readShotVideoTakeProduction,
  type ShotVideoTakeProductionContextResponse,
  type ShotVideoTakeProductionRead,
  updateShotVideoTakeProduction,
} from '@/services/studio-shot-video-takes-api';
import { useShotVideoTakeProduction } from './use-shot-video-take-production';

vi.mock('@/services/studio-shot-video-takes-api', () => ({
  clearShotVideoTakeInput: vi.fn(),
  deleteShotVideoTakeInput: vi.fn(),
  estimateShotVideoTakeProduction: vi.fn(),
  planShotVideoTakeProduction: vi.fn(),
  readShotVideoTakeProduction: vi.fn(),
  selectShotVideoTakeInput: vi.fn(),
  updateShotVideoTakeProduction: vi.fn(),
}));

describe('useShotVideoTakeProduction', () => {
  beforeEach(() => {
    vi.mocked(readShotVideoTakeProduction).mockReset();
    vi.mocked(readShotVideoTakeProduction).mockResolvedValue(
      productionRead(initialTake())
    );
    vi.mocked(updateShotVideoTakeProduction).mockReset();
    vi.mocked(updateShotVideoTakeProduction).mockResolvedValue({
      context: productionContext(
        takeWithProduction({
          inputModeId: 'text-only',
          modelChoice: 'fal-ai/bytedance/seedance-2.0',
          parameterValues: { duration: 9 },
        })
      ),
      resourceKeys: [],
    });
    vi.mocked(estimateShotVideoTakeProduction).mockReset();
    vi.mocked(estimateShotVideoTakeProduction).mockResolvedValue(
      {} as Awaited<ReturnType<typeof estimateShotVideoTakeProduction>>
    );
    vi.mocked(planShotVideoTakeProduction).mockReset();
    vi.mocked(planShotVideoTakeProduction).mockResolvedValue(
      {
        take: initialTake(),
        target: { kind: 'shot-video-take', takeId: 'take_001' },
        diagnostics: [],
        references: {
          general: [],
          lookbook: [],
          dialogueAudio: [],
          castMembers: [],
          locations: [],
          dialogueAudioCapability: null,
        },
        plan: {
          request: {
            inputMode: 'text-only',
            shotGroupMode: 'single-shot',
            modelChoice: 'fal-ai/bytedance/seedance-2.0',
          },
          finalEstimate: null,
          diagnostics: [],
        },
      } as unknown as Awaited<ReturnType<typeof planShotVideoTakeProduction>>
    );
  });

  it('forwards the persisted production mutation result into local take state', async () => {
    render(<ShotVideoTakeProductionHarness />);

    fireEvent.click(await screen.findByRole('button', { name: 'Set duration' }));

    await waitFor(() => {
      expect(updateShotVideoTakeProduction).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        'take_001',
        {
          inputModeId: 'text-only',
          modelChoice: 'fal-ai/bytedance/seedance-2.0',
          parameterValues: { duration: 9 },
        }
      );
    });
    await waitFor(() => {
      expect(screen.getByText('duration:9')).toBeTruthy();
    });
  });

  it('flushes pending AI Production edits when the editor unmounts', async () => {
    const { unmount } = render(<ShotVideoTakeProductionHarness />);

    fireEvent.click(await screen.findByRole('button', { name: 'Set duration' }));
    unmount();

    await waitFor(() => {
      expect(updateShotVideoTakeProduction).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        'take_001',
        {
          inputModeId: 'text-only',
          modelChoice: 'fal-ai/bytedance/seedance-2.0',
          parameterValues: { duration: 9 },
        }
      );
    });
  });
});

function ShotVideoTakeProductionHarness() {
  const production = useShotVideoTakeProduction({
    projectName: 'constantinople',
    sceneId: 'scene_hook',
    takeId: 'take_001',
  });

  if (production.loadState !== 'ready') {
    return <p>Loading</p>;
  }

  return (
    <div>
      <p>{`duration:${production.take?.state.production.parameterValues?.duration ?? 'none'}`}</p>
      <Button type='button' onClick={() => production.setParameter('duration', 9)}>
        Set duration
      </Button>
    </div>
  );
}

function productionRead(
  take: SceneShotVideoTake
): ShotVideoTakeProductionRead {
  return {
    context: productionContext(take),
    models: {
      inputModeId: 'text-only',
      shotGroupMode: 'single-shot',
      models: [],
      defaults: {
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
      },
    },
  } as unknown as ShotVideoTakeProductionRead;
}

function productionContext(
  take: SceneShotVideoTake
): ShotVideoTakeProductionContextResponse {
  return {
    take,
    defaults: {
      inputModeId: 'text-only',
    },
  } as unknown as ShotVideoTakeProductionContextResponse;
}

function initialTake(): SceneShotVideoTake {
  return takeWithProduction({
    inputModeId: 'text-only',
    modelChoice: 'fal-ai/bytedance/seedance-2.0',
    parameterValues: { duration: 6 },
  });
}

function takeWithProduction(
  production: SceneShotVideoTake['state']['production']
): SceneShotVideoTake {
  return {
    takeId: 'take_001',
    sceneId: 'scene_hook',
    sourceShotListId: 'shot_list_hook',
    shotIds: ['shot_001'],
    title: 'Shot Video Take',
    picked: false,
    state: {
      version: 2,
    structure: {
      mode: 'continuous',
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
      production,
    },
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
      history: {
        differences: [],
        message: 'This take matches its recorded history snapshot.',
      },
    },
  };
}
