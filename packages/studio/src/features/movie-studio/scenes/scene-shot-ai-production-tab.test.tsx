// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  SceneShot,
  SceneShotListDocument,
  ShotVideoTakeGenerationContext,
  ShotVideoTakeModelListReport,
  ShotVideoTakePreflightReport,
  ShotVideoTakeProductionEstimateReport,
} from '@gorenku/studio-core/client';
import type { SceneShotListResourceResponse } from '@/services/studio-project-contracts';
import { readSceneShotListResource } from '@/services/studio-screenplay-api';
import {
  estimateShotVideoTakeProduction,
  previewShotVideoTakeProduction,
  readShotVideoTakeProduction,
} from '@/services/studio-shot-video-takes-api';
import { readLocationAssets } from '@/services/studio-project-assets-api';
import { SceneShotsTab } from './scene-shots-tab';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/services/studio-screenplay-api', () => ({
  readSceneShotListResource: vi.fn(),
  updateSceneShotSpecs: vi.fn(),
}));

vi.mock('@/services/studio-shot-video-takes-api', () => ({
  readShotVideoTakeProduction: vi.fn(),
  updateShotVideoTakeProduction: vi.fn(),
  estimateShotVideoTakeProduction: vi.fn(),
  previewShotVideoTakeProduction: vi.fn(),
  selectShotVideoTakeInput: vi.fn(),
  clearShotVideoTakeInput: vi.fn(),
}));

vi.mock('@/services/studio-project-assets-api', () => ({
  readLocationAssets: vi.fn().mockResolvedValue([]),
  locationAssetFileUrl: vi.fn(() => ''),
}));

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= ResizeObserverStub;

function shot(id: string, title: string): SceneShot {
  return {
    shotId: id,
    title,
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
}

const SHOTS = [shot('shot_001', 'Map study'), shot('shot_002', 'Reaction')];

function shotList(): SceneShotListDocument {
  return {
    kind: 'sceneShotList',
    sceneId: 'scene_hook',
    title: 'Coverage',
    summary: '',
    coverageStrategy: '',
    shots: SHOTS,
    videoTakeProductionGroups: [
      {
        productionGroupId: 'group_1',
        shotIds: ['shot_001', 'shot_002'],
        videoTakeProduction: { intentId: 'multi-shot' },
      },
    ],
  };
}

function resource(): SceneShotListResourceResponse {
  return {
    scene: { id: 'scene_hook', sequenceId: 'seq', title: 'Scene' },
    sequence: { id: 'seq', actId: 'act', number: 1, title: 'Seq', sceneCount: 1 },
    act: { id: 'act', title: 'Act', sequenceCount: 1, sceneCount: 1 },
    projectAspectRatio: '16:9',
    activeShotListId: 'shot_list_hook',
    activeShotList: shotList(),
    storyboardSheet: null,
    storyboardImagesByShotId: {},
    castMemberLabels: {},
    locationLabels: {},
  };
}

function context(): ShotVideoTakeGenerationContext {
  return {
    purpose: 'shot.video-take',
    target: {
      kind: 'sceneShotGroup',
      id: 'group_1',
      sceneId: 'scene_hook',
      shotListId: 'shot_list_hook',
      productionGroupId: 'group_1',
      shotIds: ['shot_001', 'shot_002'],
    },
    project: { name: 'p', title: 'P', aspectRatio: '16:9' },
    scene: { id: 'scene_hook', title: 'Scene', setting: {}, storyFunction: [] },
    shotList: {
      id: 'shot_list_hook',
      title: 'Coverage',
      summary: '',
      createdAt: '',
      updatedAt: '',
      isActive: true,
    },
    productionGroup: {
      productionGroupId: 'group_1',
      shotIds: ['shot_001', 'shot_002'],
      videoTakeProduction: {
        intentId: 'multi-shot',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
      },
    },
    shots: SHOTS,
    referencedCast: [],
    referencedLocations: [],
    activeLookbook: null,
    storyboardImages: [],
    availableInputs: [],
    existingTakes: [],
    defaults: {
      intentId: 'multi-shot',
      imageDependencyModelChoice: 'fal-ai/nano-banana-2',
      parameterValues: {},
    },
    resourceKeys: [],
  };
}

function models(): ShotVideoTakeModelListReport {
  return {
    purpose: 'shot.video-take',
    target: context().target,
    defaultModelChoice: 'fal-ai/bytedance/seedance-2.0',
    models: [
      {
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        label: 'Seedance 2.0',
        available: true,
        supportedIntents: ['text-only', 'multi-shot'],
        duration: { supported: true, values: [5, 8, 10], default: 5 },
        inputRoles: [],
        parameters: [],
        estimateInputs: {
          canEstimateBeforeDependenciesExist: true,
          requiresPreparedInputs: false,
        },
      },
    ],
  };
}

function preflight(): ShotVideoTakePreflightReport {
  return {
    valid: true,
    issues: [],
    target: context().target,
    productionGroup: context().productionGroup,
    intentId: 'multi-shot',
    modelChoice: 'fal-ai/bytedance/seedance-2.0',
    preparedInputs: [],
    availableInputs: [],
    inputsToCreate: [],
    prompts: [],
    estimateLines: [],
    finalTake: {
      purpose: 'shot.video-take',
      canCreateSpec: true,
      title: 'Scene video take',
    },
    agentBrief: 'Do the thing.',
    estimate: null,
  };
}

function estimate(): ShotVideoTakeProductionEstimateReport {
  return {
    target: context().target,
    productionGroup: context().productionGroup,
    intentId: 'multi-shot',
    modelChoice: 'fal-ai/bytedance/seedance-2.0',
    estimate: {
      provider: 'fal-ai',
      model: 'fal-ai/bytedance/seedance-2.0',
      mediaKind: 'video',
      pricing: null,
      estimatedCostUsd: 0.42,
      approvalToken: 'approval-token',
      billableUnits: {},
      warnings: [],
    },
    issues: [],
  };
}

async function openAiProductionTab() {
  const tab = await screen.findByRole('tab', { name: 'AI Production' });
  fireEvent.focus(tab);
  fireEvent.click(tab);
}

describe('AI Production tab', () => {
  beforeEach(() => {
    vi.mocked(readSceneShotListResource).mockReset().mockResolvedValue(resource());
    vi.mocked(readShotVideoTakeProduction)
      .mockReset()
      .mockResolvedValue({ context: context(), models: models() });
    vi.mocked(estimateShotVideoTakeProduction)
      .mockReset()
      .mockResolvedValue(estimate());
    vi.mocked(previewShotVideoTakeProduction)
      .mockReset()
      .mockResolvedValue(preflight());
    vi.mocked(readLocationAssets).mockReset().mockResolvedValue([]);
  });

  it('shows AI Production inside the lower shot tab region', async () => {
    render(<SceneShotsTab projectName='c' sceneId='scene_hook' />);
    expect(await screen.findByRole('tab', { name: 'AI Production' })).not.toBeNull();
  });

  it('shows the group tag for a multi-shot group at the tab bar', async () => {
    render(<SceneShotsTab projectName='c' sceneId='scene_hook' />);
    expect(await screen.findByText('Shot 1-2')).not.toBeNull();
  });

  it('renders a group button on each rail card using local controls', async () => {
    render(<SceneShotsTab projectName='c' sceneId='scene_hook' />);
    const groupButton = await screen.findByRole('button', {
      name: 'Toggle grouping for Shot 1',
    });
    expect(groupButton.tagName).toBe('BUTTON');
  });

  it('renders intent gating, the model table, and opens the preview dialog', async () => {
    render(<SceneShotsTab projectName='c' sceneId='scene_hook' />);
    await openAiProductionTab();

    // Multi-shot group: multi-shot enabled, single-shot intents disabled.
    const multiShot = await screen.findByRole('button', { name: 'Multi-shot' });
    expect(multiShot.hasAttribute('disabled')).toBe(false);
    const textOnly = screen.getByRole('button', { name: 'Text only' });
    expect(textOnly.hasAttribute('disabled')).toBe(true);

    // Model table columns are exactly Model, Duration, Status.
    expect(screen.getByRole('columnheader', { name: 'Model' })).not.toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Duration' })).not.toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Status' })).not.toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Cost' })).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Fit' })).toBeNull();
    expect(await screen.findByText('$0.42')).not.toBeNull();

    // Preview Take Plan opens the dialog.
    fireEvent.click(screen.getByRole('button', { name: 'Preview Take Plan' }));
    await waitFor(() =>
      expect(previewShotVideoTakeProduction).toHaveBeenCalled()
    );
    expect(await screen.findByText('References')).not.toBeNull();
    expect(screen.getAllByText('Estimated total').length).toBeGreaterThan(0);
  });

  it('does not mark an active Lookbook as ready without a reference image', async () => {
    const lookbookContext = {
      ...context(),
      activeLookbook: {
        id: 'lookbook_imperial_wound',
        name: 'Imperial Wound',
        thesis: 'Stone, smoke, and wounded ceremony.',
      },
    };
    vi.mocked(readShotVideoTakeProduction).mockResolvedValue({
      context: lookbookContext,
      models: models(),
    });
    vi.mocked(previewShotVideoTakeProduction).mockResolvedValue({
      ...preflight(),
      target: lookbookContext.target,
      productionGroup: lookbookContext.productionGroup,
    });

    render(<SceneShotsTab projectName='c' sceneId='scene_hook' />);
    await openAiProductionTab();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Preview Take Plan' })
    );

    const dialog = await screen.findByRole('dialog', {
      name: 'Preview Take Plan',
    });
    expect(within(dialog).getByText('Imperial Wound')).not.toBeNull();
    expect(within(dialog).getByText('Lookbook reference')).not.toBeNull();
    expect(within(dialog).getByText('Needed')).not.toBeNull();
    expect(within(dialog).queryByText('Available')).toBeNull();
    expect(within(dialog).queryByText('Ready')).toBeNull();
  });
});
