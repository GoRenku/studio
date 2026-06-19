// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  SceneShot,
  SceneShotListDocument,
  SceneShotVideoTake,
  ShotVideoTakeProductionContext,
  ShotVideoTakeModelListReport,
  ShotVideoTakeProductionEstimateReport,
  ShotVideoTakeProductionPlanReport,
} from '@gorenku/studio-core/client';
import type { SceneShotListResourceResponse } from '@/services/studio-project-contracts';
import { readSceneShotListResource } from '@/services/studio-screenplay-api';
import {
  createSceneShotVideoTake,
  estimateShotVideoTakeProduction,
  listSceneShotVideoTakes,
  planShotVideoTakeProduction,
  readShotVideoTakeProduction,
} from '@/services/studio-shot-video-takes-api';
import type {
  SceneShotDetailTab,
  StudioSelection,
} from '../movie-studio-selection';
import { SceneShotsTab } from './scene-shots-tab';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/services/studio-screenplay-api', () => ({
  readSceneShotListResource: vi.fn(),
}));

vi.mock('@/services/studio-shot-video-takes-api', () => ({
  listSceneShotVideoTakes: vi.fn(),
  createSceneShotVideoTake: vi.fn(),
  readShotVideoTakeProduction: vi.fn(),
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
    storyboardImagesByShotId: {},
    castMemberLabels: {},
    castMemberImages: {},
    locationLabels: {},
  };
}

function take(): SceneShotVideoTake {
  const production = {
    inputModeId: 'reference',
    modelChoice: 'fal-ai/bytedance/seedance-2.0',
  } as const;
  return {
    takeId: 'take_1',
    sceneId: 'scene_hook',
    sourceShotListId: 'shot_list_hook',
    shotIds: ['shot_001', 'shot_002'],
    title: 'Shot Video Take 1',
    picked: false,
    state: emptyTakeState(production),
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
}

function emptyTakeState(production = {}) {
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
    production,
  };
}

function context(): ShotVideoTakeProductionContext {
  return {
    purpose: 'shot.video-take',
    target: {
      kind: 'sceneShotVideoTake',
      id: 'take_1',
      sceneId: 'scene_hook',
      takeId: 'take_1',
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
    take: take(),
    shots: SHOTS,
    displayShots: SHOTS,
    referencedCast: [],
    referencedLocations: [],
    activeLookbook: null,
    storyboardImages: [],
    mediaInputs: [],
    outputs: [],
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
    take: context().take,
    finalPrompt: input.finalPrompt ? { prompt: input.finalPrompt } : null,
    plan: {
      planId: 'plan_001',
        request: {
          projectId: 'project_001',
          sceneId: 'scene_hook',
        shotListId: 'shot_list_hook',
        takeId: 'take_1',
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
      dependencyInventory: {
        rootPurpose: 'shot.video-take',
        rootTarget: context().target,
        dependencies: [],
        rootGeneration: {
          id: 'root:shot.video-take',
          purpose: 'shot.video-take',
          target: context().target,
          label: 'Final video take',
          mediaKind: 'video',
          pricing: { state: 'priced', estimatedUsd: 0.42 },
          canCreateSpec: true,
          blockedReason: null,
          estimate: null,
          diagnostics: [],
        },
        estimate: {
          state: 'complete',
          estimatedTotalUsd: 0.42,
          pricedDependencyCount: 1,
          unpricedDependencyCount: 0,
          unavailableDependencyCount: 0,
          requiresPriceOverride: false,
        },
        diagnostics: [],
        agentChecklist: [],
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
    references: {
      general: [],
      dialogueAudio: [],
      dialogueAudioCapability: {
        state: 'ok',
        supported: false,
        selectedCount: 0,
        maxCount: null,
        modelLabel: 'Seedance 2.0',
        message: 'This model does not use audio references',
        diagnostics: [],
      },
      lookbook: input.lookbook
        ? [
            {
              id: 'lookbook_imperial_wound:planned-lookbook-sheet',
              lookbookSheetId: null,
              lookbookId: 'lookbook_imperial_wound',
              title: 'Imperial Wound',
              selected: true,
              defaultSelected: true,
              card: {
                state: 'selected-planned',
                mediaKind: 'image',
                defaultIncluded: true,
                included: true,
                required: false,
                inclusionOverride: null,
                pricing: { state: 'priced', estimatedUsd: 0.04 },
                previews: [],
                diagnostics: [],
              },
            },
          ]
        : [],
      castMembers: [],
      locations: [],
    },
    diagnostics: input.promptStale
      ? [
          {
            code: 'PROJECT_DATA378',
            message: 'The saved prompt was authored for a previous Shot Video Take.',
            severity: 'error',
            location: { path: ['take', 'production', 'agentProposal'] },
          },
        ]
      : [],
  };
}

function estimate(): ShotVideoTakeProductionEstimateReport {
  return {
    target: context().target,
    take: context().take,
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
    vi.mocked(listSceneShotVideoTakes)
      .mockReset()
      .mockResolvedValue({ takes: [take()] });
    vi.mocked(createSceneShotVideoTake)
      .mockReset()
      .mockResolvedValue(take());
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
    render(<SceneShotsTabHarness />);
    expect(await screen.findByRole('tab', { name: 'AI Production' })).not.toBeNull();
  });

  it('renders input modes, the model table, and inline run setup with a multi-shot group tag', async () => {
    render(<SceneShotsTabHarness />);
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

    render(<SceneShotsTabHarness />);
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

    render(<SceneShotsTabHarness />);
    const tab = await screen.findByRole('tab', { name: 'References' });
    fireEvent.focus(tab);
    fireEvent.click(tab);

    expect(await screen.findByText('Imperial Wound')).not.toBeNull();
    expect(await screen.findByText('$0.04')).not.toBeNull();
    expect(screen.queryByText('Available')).toBeNull();
    expect(screen.queryByText('Ready')).toBeNull();
  });
});

function SceneShotsTabHarness({
  initialShotTab,
}: {
  initialShotTab?: SceneShotDetailTab;
} = {}) {
  const [selection, setSelection] = React.useState<
    Extract<StudioSelection, { type: 'scene' }>
  >({
    type: 'scene',
    id: 'scene_hook',
    sceneTab: 'shots',
    ...(initialShotTab ? { shotTab: initialShotTab } : {}),
  });
  return (
    <SceneShotsTab
      projectName='c'
      sceneId='scene_hook'
      shotId={selection.shotId}
      shotTab={selection.shotTab}
      onSelect={(nextSelection) => {
        if (nextSelection.type === 'scene') {
          setSelection(nextSelection);
        }
      }}
    />
  );
}
