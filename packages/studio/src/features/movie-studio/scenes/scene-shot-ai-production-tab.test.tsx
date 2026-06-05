// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  SceneShot,
  SceneShotListDocument,
  ShotVideoTakeGenerationContext,
  ShotVideoTakeModelListReport,
  ShotVideoTakeProductionEstimateReport,
  ShotVideoTakeProductionPlanReport,
} from '@gorenku/studio-core/client';
import type { SceneShotListResourceResponse } from '@/services/studio-project-contracts';
import { readSceneShotListResource } from '@/services/studio-screenplay-api';
import {
  estimateShotVideoTakeProduction,
  planShotVideoTakeProduction,
  readShotVideoTakeProduction,
} from '@/services/studio-shot-video-takes-api';
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
  planShotVideoTakeProduction: vi.fn(),
  selectShotVideoTakeInput: vi.fn(),
  clearShotVideoTakeInput: vi.fn(),
}));

vi.mock('@/services/studio-project-assets-api', () => ({
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
    videoTakeRailGroups: [
      { productionGroupId: 'group_1', shotIds: ['shot_001', 'shot_002'] },
    ],
    videoTakeProductionGroups: [
      {
        productionGroupId: 'group_1',
        shotIds: ['shot_001', 'shot_002'],
        videoTakeProduction: { inputModeId: 'reference' },
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
        inputModeId: 'reference',
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
    shotGroupMode: 'multi-shot',
    defaults: {
      inputModeId: 'reference',
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
    shotGroupMode: 'multi-shot',
    defaultModelChoice: 'fal-ai/bytedance/seedance-2.0',
    models: [
      {
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        label: 'Seedance 2.0',
        available: true,
        supportedInputModes: ['text-only', 'reference'],
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

function productionPlan(
  input: {
    finalPrompt?: string;
    lookbook?: boolean;
    promptStale?: boolean;
  } = {}
): ShotVideoTakeProductionPlanReport {
  return {
    target: context().target,
    productionGroup: context().productionGroup,
    finalPrompt: input.finalPrompt ? { prompt: input.finalPrompt } : null,
    plan: {
      planId: 'plan_001',
      request: {
        projectId: 'project_001',
        sceneId: 'scene_hook',
        shotListId: 'shot_list_hook',
        productionGroupId: 'group_1',
        inputMode: 'reference',
        shotGroupMode: 'multi-shot',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        routeSettings: {},
        inputPolicy: { defaultMode: 'auto' },
      },
      model: {
        choice: 'fal-ai/bytedance/seedance-2.0',
        label: 'Seedance 2.0',
        version: '2.0',
        provider: 'fal-ai',
      },
      route: {
        inputMode: 'reference',
        shotGroupMode: 'multi-shot',
        providerModel: 'bytedance/seedance-2.0/reference-to-video',
        mode: 'image-to-video',
        inputRoles: [],
        parameters: [],
      },
      dependencyMap: {
        rootPurpose: 'shot.video-take',
        nodes: [],
        edges: [],
        estimate: {
          state: 'complete',
          estimatedTotalUsd: 0.42,
          pricedNodeCount: 1,
          unpricedNodeCount: 0,
          missingNodeCount: 0,
          requiresPriceOverride: false,
        },
        execution: { topologicalNodeIds: [], levels: [], diagnostics: [] },
        diagnostics: [],
      },
      lines: [],
      estimate: {
        state: 'complete',
        estimatedTotalUsd: 0.42,
        pricedLineCount: 1,
        unpricedLineCount: 0,
        missingLineCount: 0,
        requiresPriceOverride: false,
      },
      diagnostics: [],
      finalEstimate: null,
    },
    castReferences: [],
    locationReferences: [],
    lookbookReferences: input.lookbook
      ? [
          {
            lookbookSheetId: null,
            lookbookId: 'lookbook_imperial_wound',
            title: 'Imperial Wound',
            selected: true,
            defaultSelected: true,
            image: {
              state: 'selected-planned',
              mediaKind: 'image',
              pricing: { state: 'priced', estimatedUsd: 0.04 },
              previews: [],
              diagnostics: [],
            },
          },
        ]
      : [],
    imageReferences: [],
    diagnostics: input.promptStale
      ? [
          {
            code: 'PROJECT_DATA378',
            message: 'The saved prompt was authored for a previous shot grouping.',
            severity: 'error',
            location: { path: ['videoTakeProductionGroups', '0', 'agentProposal'] },
          },
        ]
      : [],
  };
}

function estimate(): ShotVideoTakeProductionEstimateReport {
  return {
    target: context().target,
    productionGroup: context().productionGroup,
    inputModeId: 'reference',
    shotGroupMode: 'multi-shot',
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
    vi.mocked(planShotVideoTakeProduction)
      .mockReset()
      .mockResolvedValue(productionPlan({ finalPrompt: 'Final siege prompt.' }));
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
      name: 'Cycle grouping for Shot 1',
    });
    expect(groupButton.tagName).toBe('BUTTON');
  });

  it('renders input modes, the model table, and inline run setup with a multi-shot group tag', async () => {
    render(<SceneShotsTab projectName='c' sceneId='scene_hook' />);
    await openAiProductionTab();

    expect(screen.queryByRole('button', { name: 'Multi-shot' })).toBeNull();
    const textOnly = await screen.findByRole('button', { name: 'Text only' });
    expect(textOnly.hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: 'Reference' }).hasAttribute('disabled')).toBe(
      false
    );

    // Model table columns are exactly Model, Duration, Status.
    expect(screen.getByRole('columnheader', { name: 'Model' })).not.toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Duration' })).not.toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Status' })).not.toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Cost' })).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Fit' })).toBeNull();
    expect(await screen.findByText('$0.42')).not.toBeNull();
    expect(await screen.findByText('Final siege prompt.')).not.toBeNull();
    expect(screen.getAllByText('Estimated total').length).toBeGreaterThan(0);
    expect(await screen.findByText('multi-shot')).not.toBeNull();
  });

  it('marks the final prompt as needing refresh when the production plan is stale', async () => {
    vi.mocked(planShotVideoTakeProduction).mockResolvedValue(
      productionPlan({ finalPrompt: 'Final siege prompt.', promptStale: true })
    );

    render(<SceneShotsTab projectName='c' sceneId='scene_hook' />);
    await openAiProductionTab();

    expect(await screen.findByText('needs refresh')).not.toBeNull();
    expect(await screen.findByText('Final siege prompt.')).not.toBeNull();
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
    vi.mocked(planShotVideoTakeProduction).mockResolvedValue(
      productionPlan({ lookbook: true })
    );

    render(<SceneShotsTab projectName='c' sceneId='scene_hook' />);
    const tab = await screen.findByRole('tab', { name: 'Lookbook' });
    fireEvent.focus(tab);
    fireEvent.click(tab);

    expect(await screen.findByText('Imperial Wound')).not.toBeNull();
    expect(await screen.findByText('$0.04')).not.toBeNull();
    expect(screen.queryByText('Available')).toBeNull();
    expect(screen.queryByText('Ready')).toBeNull();
  });
});
