// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  estimateShotVideoTakeGeneration,
  readShotVideoTakeWorkspace,
  setShotVideoTakeGenerationReference,
  setShotVideoTakeGenerationSpec,
} from '@/services/studio-shot-video-takes-api';
import { Button } from '@/ui/button';
import { useShotVideoTakeProduction } from './use-shot-video-take-production';

vi.mock('@/services/studio-shot-video-takes-api', () => ({
  estimateShotVideoTakeGeneration: vi.fn(),
  readShotVideoTakeWorkspace: vi.fn(),
  setShotVideoTakeGenerationReference: vi.fn(),
  setShotVideoTakeGenerationSpec: vi.fn(),
}));

describe('useShotVideoTakeProduction', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.mocked(readShotVideoTakeWorkspace).mockReset().mockResolvedValue(
      workspace() as never
    );
    vi.mocked(setShotVideoTakeGenerationSpec).mockReset().mockResolvedValue({
      workspace: workspace() as never,
      resourceKeys: [],
    });
    vi.mocked(estimateShotVideoTakeGeneration).mockReset().mockResolvedValue({
      valid: false,
      diagnostics: [],
    });
    vi.mocked(setShotVideoTakeGenerationReference).mockReset().mockResolvedValue({
      workspace: workspace() as never,
      resourceKeys: [],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads the focused workspace and exposes Engines-derived model state', async () => {
    render(<Harness />);
    expect(await screen.findByText('Seedance 2.0')).toBeTruthy();
    expect(readShotVideoTakeWorkspace).toHaveBeenCalledWith(
      'constantinople',
      'scene_hook',
      'take_001'
    );
  });

  it('loads a multi-cut workspace for the selected Shot', async () => {
    render(<Harness selectedShotId='shot_002' />);
    expect(await screen.findByText('Seedance 2.0')).toBeTruthy();
    expect(readShotVideoTakeWorkspace).toHaveBeenCalledWith(
      'constantinople',
      'scene_hook',
      'take_001',
      'shot_002'
    );
  });

  it('autosaves authored setup through the generic spec command', async () => {
    render(<Harness />);
    await screen.findByText('Seedance 2.0');
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Set duration' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    vi.useRealTimers();

    await waitFor(() =>
      expect(setShotVideoTakeGenerationSpec).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        'take_001',
        expect.objectContaining({
          modelChoice: 'fal-ai/bytedance/seedance-2.0',
          parameterValues: { duration: 8 },
        })
      )
    );
  });

  it('does not write generation defaults merely because the workspace loaded', async () => {
    render(<Harness />);
    await screen.findByText('Seedance 2.0');
    expect(setShotVideoTakeGenerationSpec).not.toHaveBeenCalled();
  });

  it('estimates the resolved minimum duration as soon as the workspace loads', async () => {
    vi.mocked(estimateShotVideoTakeGeneration).mockResolvedValue({
      valid: true,
      diagnostics: [],
      estimate: {
        provider: 'fal-ai',
        model: 'bytedance/seedance-2.0',
        estimatedCostUsd: 0.42,
        billableUnits: { duration: 5 },
      },
    });
    render(<Harness />);

    await waitFor(() =>
      expect(estimateShotVideoTakeGeneration).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        'take_001',
        {
          inputModeId: 'text-only',
          modelChoice: 'fal-ai/bytedance/seedance-2.0',
          parameterValues: { duration: 5 },
        }
      )
    );
  });

  it('re-estimates an authored duration without requiring an autosave first', async () => {
    render(<Harness />);
    await screen.findByText('Seedance 2.0');
    fireEvent.click(screen.getByRole('button', { name: 'Set duration' }));

    await waitFor(() =>
      expect(estimateShotVideoTakeGeneration).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        'take_001',
        expect.objectContaining({ parameterValues: { duration: 8 } })
      )
    );
  });

  it('resets Run Setup to the new model minimum before estimating a model change', async () => {
    render(<Harness />);
    await screen.findByText('Seedance 2.0');
    fireEvent.click(screen.getByRole('button', { name: 'Select alternate model' }));

    await waitFor(() =>
      expect(estimateShotVideoTakeGeneration).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        'take_001',
        expect.objectContaining({
          modelChoice: 'fal-ai/alternate-video-model',
          parameterValues: { duration: 4, resolution: '720p' },
        })
      )
    );
  });

  it('flushes pending authored setup when the editor unmounts', async () => {
    const { unmount } = render(<Harness />);
    await screen.findByText('Seedance 2.0');
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Set duration' }));
    await act(async () => {
      unmount();
      await Promise.resolve();
    });
    vi.useRealTimers();

    await waitFor(() =>
      expect(setShotVideoTakeGenerationSpec).toHaveBeenCalled()
    );
  });
});

function Harness({ selectedShotId }: { selectedShotId?: string }) {
  const production = useShotVideoTakeProduction({
    projectName: 'constantinople',
    sceneId: 'scene_hook',
    takeId: 'take_001',
    ...(selectedShotId ? { selectedShotId } : {}),
    autosaveDelayMs: 500,
  });
  if (production.loadState !== 'ready') {
    return <p>Loading</p>;
  }
  return (
    <div>
      <p>{production.models?.[0]?.label}</p>
      <Button
        type='button'
        onClick={() => production.setParameter('duration', 8)}
      >
        Set duration
      </Button>
      <Button
        type='button'
        onClick={() => production.setModel('fal-ai/alternate-video-model')}
      >
        Select alternate model
      </Button>
    </div>
  );
}

function workspace() {
  const take = {
    takeId: 'take_001',
    sceneId: 'scene_hook',
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
        message: 'Editable.',
      },
      resolvability: {
        state: 'resolvable' as const,
        diagnostics: [],
        message: 'Resolvable.',
      },
      archive: { state: 'active' as const, message: 'Active.' },
      history: { differences: [], message: 'Current.' },
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
    sourceShots: [],
    displayShots: [],
    storyboardImages: [],
    generation: {
      context: {
        purpose: 'shot.video-take',
        target: { kind: 'sceneShotVideoTake', id: 'take_001' },
        outputMediaKind: 'video',
        facts: {},
        settings: { fixed: [], recommended: [] },
        models: [],
        referenceGuide: { sections: [], additionalReferences: [], notices: [] },
      },
      spec: null,
      setup: {
        inputModeId: 'text-only',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        parameterValues: { duration: 5 },
      },
      models: [{
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        provider: 'fal-ai',
        model: 'bytedance/seedance-2.0',
        label: 'Seedance 2.0',
        supportedInputModes: ['text-only'],
        duration: { supported: true, values: [5, 8], default: 5 },
        parameters: [{
          name: 'duration',
          label: 'Duration',
          required: false,
          defaultValue: 5,
          allowedValues: [5, 8],
        }],
      }, {
        modelChoice: 'fal-ai/alternate-video-model',
        provider: 'fal-ai',
        model: 'alternate-video-model',
        label: 'Alternate model',
        supportedInputModes: ['text-only'],
        duration: { supported: true, values: [4, 6, 8], default: 4 },
        parameters: [{
          name: 'duration',
          label: 'Duration',
          required: false,
          defaultValue: 4,
          allowedValues: [4, 6, 8],
        }, {
          name: 'resolution',
          label: 'Resolution',
          required: false,
          defaultValue: '720p',
          allowedValues: ['720p'],
        }],
      }],
      references: {
        general: [],
        lookbook: [],
        dialogueAudio: [],
        dialogueAudioCapability: {
          state: 'unsupported',
          supported: false,
          selectedCount: 0,
          maxCount: null,
          modelLabel: 'Seedance 2.0',
          message: 'This model does not use audio references.',
          diagnostics: [],
        },
        castMembers: [],
        locations: [],
      },
      finalPrompt: null,
      estimate: null,
      run: null,
      diagnostics: [],
    },
    resourceKeys: [],
  };
}
