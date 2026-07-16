// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SceneShotAiProductionTab } from './scene-shot-ai-production-tab';
import type { UseShotVideoTakeProductionResult } from './use-shot-video-take-production';

describe('AI Production tab', () => {
  it('preserves Input, Model, and Run Setup regions', () => {
    render(<SceneShotAiProductionTab production={production()} />);

    expect(screen.getByText('Input')).toBeTruthy();
    expect(screen.getByText('Run Setup')).toBeTruthy();
    expect(screen.getByText('Final Prompt')).toBeTruthy();
    expect(screen.getByText('Final siege prompt.')).toBeTruthy();
    expect(screen.getByText('Estimated total')).toBeTruthy();
    expect(screen.getByText('$0.42')).toBeTruthy();
  });

  it('renders exactly Model and Duration column headers', () => {
    render(<SceneShotAiProductionTab production={production()} />);

    const headers = screen.getAllByRole('columnheader').map((header) =>
      header.textContent?.trim()
    );
    expect(headers).toEqual(['Model', 'Duration']);
    expect(screen.queryByRole('columnheader', { name: 'Status' })).toBeNull();
    expect(screen.queryByText('Input required')).toBeNull();
    expect(screen.queryByText('Unavailable')).toBeNull();
  });

  it('preserves model and input-mode selection behavior', () => {
    const setInputMode = vi.fn();
    const setModel = vi.fn();
    render(
      <SceneShotAiProductionTab
        production={production({ setInputMode, setModel })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'First frame' }));
    expect(setInputMode).toHaveBeenCalledWith('first-frame');

    fireEvent.click(screen.getByRole('row', { name: /Seedance 2.0/ }));
    expect(setModel).toHaveBeenCalledWith(
      'fal-ai/bytedance/seedance-2.0'
    );
  });

  it('preserves the multi-shot group badge', () => {
    const result = production();
    result.take = {
      ...result.take!,
      shotIds: ['shot_001', 'shot_002'],
    };
    render(<SceneShotAiProductionTab production={result} />);
    expect(screen.getByText('multi-shot')).toBeTruthy();
  });
});

function production(
  overrides: Partial<UseShotVideoTakeProductionResult> = {}
): UseShotVideoTakeProductionResult {
  const take = {
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
      archive: { state: 'active' as const, message: 'This take is active.' },
      history: { differences: [], message: 'No differences.' },
    },
    createdAt: '2026-07-12T00:00:00.000Z',
    updatedAt: '2026-07-12T00:00:00.000Z',
  };
  const models = [{
    modelChoice: 'fal-ai/bytedance/seedance-2.0',
    provider: 'fal-ai',
    model: 'bytedance/seedance-2.0',
    label: 'Seedance 2.0',
    supportedInputModes: [
      'text-only' as const,
      'first-frame' as const,
      'first-last-frame' as const,
      'reference' as const,
    ],
    duration: { supported: true, values: [4, 5, 6] },
    parameters: [],
  }];
  return {
    loadState: 'ready',
    loadError: null,
    workspace: {
      take,
      generation: {
        finalPrompt: { prompt: 'Final siege prompt.' },
      },
    } as unknown as UseShotVideoTakeProductionResult['workspace'],
    models,
    take,
    isEditable: true,
    selectedInputMode: 'text-only',
    selectedModel: 'fal-ai/bytedance/seedance-2.0',
    setup: {
      inputModeId: 'text-only',
      modelChoice: 'fal-ai/bytedance/seedance-2.0',
      parameterValues: {},
    },
    setInputMode: vi.fn(),
    setModel: vi.fn(),
    setParameter: vi.fn(),
    autosave: {
      state: 'idle',
      message: null,
      flushPending: vi.fn(),
    },
    estimate: {
      valid: true,
      estimate: {
        provider: 'fal-ai',
        model: 'bytedance/seedance-2.0',
        estimatedCostUsd: 0.42,
        billableUnits: {},
      },
      diagnostics: [],
    },
    estimateState: 'idle',
    estimateError: null,
    refreshWorkspace: vi.fn(),
    setReferenceSelection: vi.fn(),
    setGenericReferences: vi.fn(),
    ...overrides,
  };
}
