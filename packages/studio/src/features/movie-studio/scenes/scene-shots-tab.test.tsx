// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
import { readLocationAssets } from '@/services/studio-project-assets-api';
import { readSceneShotListResource } from '@/services/studio-screenplay-api';
import {
  estimateShotVideoTakeProduction,
  planShotVideoTakeProduction,
  readShotVideoTakeProduction,
  updateShotVideoTakeRailGroups,
} from '@/services/studio-shot-video-takes-api';
import { SaveNotification } from '@/ui/save-notification';
import type {
  SceneShotDetailTab,
  StudioSelection,
} from '../movie-studio-selection';
import { idleSaveNotification } from '../detail-save-notification';
import { SceneShotsTab } from './scene-shots-tab';

vi.mock('@/services/studio-screenplay-api', () => ({
  readSceneShotListResource: vi.fn(),
  updateSceneShotSpecs: vi.fn(),
}));

vi.mock('@/services/studio-project-assets-api', () => ({
  readLocationAssets: vi.fn().mockResolvedValue([]),
  locationAssetFileUrl: vi.fn(
    (
      projectName: string,
      locationId: string,
      assetId: string,
      fileId: string
    ) =>
      `/studio-api/projects/${projectName}/locations/${locationId}/assets/${assetId}/files/${fileId}`
  ),
}));

vi.mock('@/services/studio-shot-video-takes-api', () => ({
  readShotVideoTakeProduction: vi.fn(),
  updateShotVideoTakeProduction: vi.fn(),
  estimateShotVideoTakeProduction: vi.fn(),
  planShotVideoTakeProduction: vi.fn(),
  updateShotVideoTakeRailGroups: vi.fn(),
  selectShotVideoTakeInput: vi.fn(),
  clearShotVideoTakeInput: vi.fn(),
  updateShotLocationReference: vi.fn(),
}));

// jsdom lacks ResizeObserver, which the Radix Slider in the video stage uses.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= ResizeObserverStub;

describe('SceneShotsTab', () => {
  beforeEach(() => {
    vi.mocked(readSceneShotListResource).mockReset();
    vi.mocked(readLocationAssets).mockReset();
    vi.mocked(readLocationAssets).mockResolvedValue([]);
    vi.mocked(readShotVideoTakeProduction)
      .mockReset()
      .mockResolvedValue({ context: productionContext(), models: productionModels() });
    vi.mocked(estimateShotVideoTakeProduction)
      .mockReset()
      .mockResolvedValue(productionEstimate());
    vi.mocked(planShotVideoTakeProduction)
      .mockReset()
      .mockResolvedValue(productionPlan());
    vi.mocked(updateShotVideoTakeRailGroups)
      .mockReset()
      .mockResolvedValue({
        resource: resource(
          shotList({
            videoTakeRailGroups: [
              { productionGroupId: 'production_group_hook', shotIds: ['shot_001'] },
            ],
          })
        ),
        resourceKeys: [],
      });
  });

  it('renders the empty state when there is no active shot list', async () => {
    vi.mocked(readSceneShotListResource).mockResolvedValue(resource(null));

    render(<SceneShotsTabHarness />);

    expect(await screen.findByText('No shot list yet.')).not.toBeNull();
  });

  it('lists shots in order and updates the detail pane on selection', async () => {
    vi.mocked(readSceneShotListResource).mockResolvedValue(
      resource(shotList())
    );

    render(<SceneShotsTabHarness />);

    const railRows = await screen.findAllByRole('button', { name: /^Shot \d+ —/ });
    expect(railRows.map((row) => row.getAttribute('aria-label'))).toEqual([
      'Shot 1 — Map study',
      'Shot 2 — Council reaction',
    ]);

    // First shot is selected by default; its story beat shows in the detail pane.
    expect(screen.getByText('Beat one.')).not.toBeNull();

    fireEvent.click(
      screen.getByRole('button', { name: 'Shot 2 — Council reaction' })
    );
    expect(await screen.findByText('Beat two.')).not.toBeNull();
    await waitFor(() => expect(readShotVideoTakeProduction).toHaveBeenCalled());
  });

  it('pre-selects the rail row from a shotId deep link', async () => {
    vi.mocked(readSceneShotListResource).mockResolvedValue(
      resource(shotList())
    );

    render(
      <SceneShotsTab
        projectName='constantinople'
        sceneId='scene_hook'
        shotId='shot_002'
      />
    );

    const selectedRow = await screen.findByRole('button', {
      name: 'Shot 2 — Council reaction',
    });
    expect(selectedRow.getAttribute('aria-current')).toBe('true');
    expect(screen.getByText('Beat two.')).not.toBeNull();
  });

  it('preserves the active shot-detail tab when selecting another shot', async () => {
    vi.mocked(readSceneShotListResource).mockResolvedValue(
      resource(shotList())
    );

    render(<SceneShotsTabHarness initialShotTab='composition' />);

    const compositionTab = await screen.findByRole('tab', {
      name: 'Composition',
    });
    expect(compositionTab.getAttribute('aria-selected')).toBe('true');

    fireEvent.click(
      screen.getByRole('button', { name: 'Shot 2 — Council reaction' })
    );

    expect(
      (await screen.findByRole('tab', { name: 'Composition' })).getAttribute(
        'aria-selected'
      )
    ).toBe('true');
    expect(
      screen
        .getByRole('button', { name: 'Shot 2 — Council reaction' })
        .getAttribute('aria-current')
    ).toBe('true');
  });

  it('renders narrative description fields and not raw ids', async () => {
    vi.mocked(readSceneShotListResource).mockResolvedValue(
      resource(shotList())
    );

    render(<SceneShotsTabHarness />);

    expect(await screen.findByText('Establish the obsession.')).not.toBeNull();
    expect(screen.getByText('Mehmed studies the map.')).not.toBeNull();
    expect(screen.getByText('Mehmed')).not.toBeNull();
    expect(screen.getByText('Council Chamber')).not.toBeNull();
    expect(screen.queryByText('cast_mehmed')).toBeNull();
    expect(screen.queryByText('loc_chamber')).toBeNull();
  });

  it('renders the consolidated shot detail tab bar', async () => {
    vi.mocked(readSceneShotListResource).mockResolvedValue(
      resource(shotList())
    );

    render(<SceneShotsTabHarness />);

    expect(await screen.findByRole('tab', { name: 'Description' })).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'Composition' })).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'Motion' })).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'References' })).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'AI Production' })).not.toBeNull();
    expect(screen.queryByRole('tab', { name: 'Lookbook' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Cast' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Location' })).toBeNull();
  });

  it('shows the empty video stage with a disabled transport', async () => {
    vi.mocked(readSceneShotListResource).mockResolvedValue(
      resource(shotList())
    );

    render(<SceneShotsTab projectName='constantinople' sceneId='scene_hook' />);

    expect(await screen.findByText('No shot video yet')).not.toBeNull();
    const playButton = screen.getByRole('button', { name: 'Play shot' });
    expect(playButton.hasAttribute('disabled')).toBe(true);
  });

  it('enters group edit mode on first group click without saving immediately', async () => {
    vi.mocked(readSceneShotListResource).mockResolvedValue(resource(shotList()));

    render(<SceneShotsTabHarness />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Cycle grouping for Shot 1' })
    );

    expect(updateShotVideoTakeRailGroups).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Editing Groups' })).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Editing Groups' }));
    expect(await screen.findByText('Review Changes')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Apply Changes' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Discard' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeNull();
  });

  it('selects the shot row when the grouping button is clicked', async () => {
    vi.mocked(readSceneShotListResource).mockResolvedValue(resource(shotList()));

    render(<SceneShotsTabHarness />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Shot 2 — Council reaction' })
    );
    expect(await screen.findByText('Beat two.')).not.toBeNull();
    await waitFor(() =>
      expect(readShotVideoTakeProduction).toHaveBeenCalledTimes(2)
    );
    expect(
      screen
        .getByRole('button', { name: 'Shot 2 — Council reaction' })
        .getAttribute('aria-current')
    ).toBe('true');

    fireEvent.click(
      screen.getByRole('button', { name: 'Cycle grouping for Shot 1' })
    );

    expect(await screen.findByText('Beat one.')).not.toBeNull();
    expect(
      screen
        .getByRole('button', { name: 'Shot 1 — Map study' })
        .getAttribute('aria-current')
    ).toBe('true');
  });

  it('keeps a dirty local grouping draft through a background resource refresh', async () => {
    vi.mocked(readSceneShotListResource)
      .mockResolvedValueOnce(resource(shotList()))
      .mockResolvedValueOnce(
        resource(
          shotList({
            videoTakeRailGroups: [
              { productionGroupId: 'server_group', shotIds: ['shot_002'] },
            ],
          })
        )
      );

    render(<SceneShotsTabHarness />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Cycle grouping for Shot 1' })
    );

    window.dispatchEvent(
      new CustomEvent('renku:studio-resource-changed', {
        detail: {
          projectName: 'constantinople',
          resourceKeys: ['scene-shot-list:shot_list_hook:video-take-rail-groups'],
        },
      })
    );

    await waitFor(() =>
      expect(readSceneShotListResource).toHaveBeenCalledTimes(2)
    );
    expect(
      document.querySelector('[data-group-id^="shot_rail_group_draft_"]')
    ).not.toBeNull();
    expect(document.querySelector('[data-group-id="server_group"]')).toBeNull();
  });

  it('discards local group edits without sending a save request', async () => {
    vi.mocked(readSceneShotListResource).mockResolvedValue(resource(shotList()));

    render(<SceneShotsTabHarness />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Cycle grouping for Shot 1' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Editing Groups' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Discard' }));

    expect(updateShotVideoTakeRailGroups).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Editing Groups' })).toBeNull()
    );
  });

  it('applies local group edits through one rail-groups request', async () => {
    vi.mocked(readSceneShotListResource).mockResolvedValue(resource(shotList()));

    render(<SceneShotsTabHarness />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Cycle grouping for Shot 1' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Editing Groups' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Apply Changes' }));

    await waitFor(() =>
      expect(updateShotVideoTakeRailGroups).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        [{ shotIds: ['shot_001'] }]
      )
    );
    expect((await screen.findByRole('status')).textContent).toContain('Saved');
  });

  it('keeps the review dialog and local draft visible when apply fails', async () => {
    vi.mocked(readSceneShotListResource).mockResolvedValue(resource(shotList()));
    vi.mocked(updateShotVideoTakeRailGroups).mockRejectedValueOnce(
      new Error('Validation failed.')
    );

    render(<SceneShotsTabHarness />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Cycle grouping for Shot 1' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Editing Groups' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Apply Changes' }));

    expect(await screen.findAllByText('Validation failed.')).toHaveLength(2);
    expect((await screen.findByRole('alert', { hidden: true })).textContent).toContain(
      'Validation failed.'
    );
    expect(screen.getByText('Review Changes')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Discard' })).not.toBeNull();
    expect(
      document.querySelector('[aria-label="Cycle grouping for Shot 1"]')
    ).not.toBeNull();
    expect(
      document.querySelector('[data-group-id^="shot_rail_group_draft_"]')
    ).not.toBeNull();
  });

  it('reloads AI Production when an applied draft receives a durable group id', async () => {
    vi.mocked(readSceneShotListResource).mockResolvedValue(resource(shotList()));

    render(<SceneShotsTabHarness />);

    await waitFor(() =>
      expect(readShotVideoTakeProduction).toHaveBeenCalledTimes(1)
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Cycle grouping for Shot 1' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Editing Groups' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Apply Changes' }));

    await waitFor(() =>
      expect(readShotVideoTakeProduction).toHaveBeenCalledTimes(2)
    );
    expect(readShotVideoTakeProduction).toHaveBeenLastCalledWith(
      'constantinople',
      'scene_hook',
      ['shot_001']
    );
  });
});

function SceneShotsTabHarness({
  initialShotId,
  initialShotTab,
}: {
  initialShotId?: string;
  initialShotTab?: SceneShotDetailTab;
} = {}) {
  const [action, setAction] = React.useState<React.ReactNode | null>(null);
  const [saveNotification, setSaveNotification] = React.useState(
    idleSaveNotification
  );
  const [selection, setSelection] = React.useState<
    Extract<StudioSelection, { type: 'scene' }>
  >({
    type: 'scene',
    id: 'scene_hook',
    sceneTab: 'shots',
    ...(initialShotId ? { shotId: initialShotId } : {}),
    ...(initialShotTab ? { shotTab: initialShotTab } : {}),
  });
  return (
    <>
      <div>{action}</div>
      <SaveNotification status={saveNotification} />
      <SceneShotsTab
        projectName='constantinople'
        sceneId='scene_hook'
        shotId={selection.shotId}
        shotTab={selection.shotTab}
        onSelect={(nextSelection) => {
          if (nextSelection.type === 'scene') {
            setSelection(nextSelection);
          }
        }}
        onHeaderActionChange={setAction}
        onSaveNotificationChange={setSaveNotification}
      />
    </>
  );
}

function shot(id: string, title: string, storyBeat: string): SceneShot {
  return {
    shotId: id,
    title,
    storyBeat,
    narrativePurpose: 'Establish the obsession.',
    description: 'Mehmed studies the map.',
    shotType: 'wide',
    subject: 'Mehmed and the map',
    action: 'He studies in silence.',
    dialogue: [],
    coveredBlockIndexes: [0],
    castMemberIds: ['cast_mehmed'],
    locationIds: ['loc_chamber'],
  };
}

function shotList(
  overrides: Partial<SceneShotListDocument> = {}
): SceneShotListDocument {
  return {
    kind: 'sceneShotList',
    sceneId: 'scene_hook',
    title: 'Council chamber coverage',
    summary: 'A restrained coverage plan.',
    coverageStrategy: 'Hold the table in one composed frame.',
    shots: [
      shot('shot_001', 'Map study', 'Beat one.'),
      shot('shot_002', 'Council reaction', 'Beat two.'),
    ],
    ...overrides,
  };
}

function resource(
  activeShotList: SceneShotListDocument | null
): SceneShotListResourceResponse {
  return {
    scene: {
      id: 'scene_hook',
      sequenceId: 'seq_offer',
      title: 'The Sound That Opens Stone',
    },
    sequence: {
      id: 'seq_offer',
      actId: 'act_one',
      number: 1,
      title: 'The Sound That Opens Stone',
      sceneCount: 1,
    },
    act: {
      id: 'act_one',
      title: 'The Offer',
      sequenceCount: 1,
      sceneCount: 1,
    },
    projectAspectRatio: '16:9',
    activeShotListId: activeShotList ? 'shot_list_hook' : null,
    activeShotList,
    storyboardImagesByShotId: {},
    castMemberLabels: { cast_mehmed: 'Mehmed' },
    locationLabels: { loc_chamber: 'Council Chamber' },
  };
}

function productionContext(): ShotVideoTakeGenerationContext {
  return {
    purpose: 'shot.video-take',
    target: {
      kind: 'sceneShotGroup',
      id: 'production_group_hook',
      sceneId: 'scene_hook',
      shotListId: 'shot_list_hook',
      productionGroupId: 'production_group_hook',
      shotIds: ['shot_001'],
    },
    project: { name: 'constantinople', title: 'Constantinople', aspectRatio: '16:9' },
    scene: {
      id: 'scene_hook',
      title: 'The Sound That Opens Stone',
      setting: {},
      storyFunction: [],
    },
    shotList: {
      id: 'shot_list_hook',
      title: 'Council chamber coverage',
      summary: 'A restrained coverage plan.',
      createdAt: '',
      updatedAt: '',
      isActive: true,
    },
    productionGroup: {
      productionGroupId: 'production_group_hook',
      shotIds: ['shot_001'],
      videoTakeProduction: { inputModeId: 'text-only' },
    },
    shots: [shot('shot_001', 'Map study', 'Beat one.')],
    referencedCast: [],
    referencedLocations: [],
    activeLookbook: null,
    storyboardImages: [],
    availableInputs: [],
    existingTakes: [],
    defaults: {
      inputModeId: 'text-only',
      imageDependencyModelChoice: 'fal-ai/nano-banana-2',
      parameterValues: {},
    },
    shotGroupMode: 'single-shot',
    resourceKeys: [],
  };
}

function productionModels(): ShotVideoTakeModelListReport {
  return {
    purpose: 'shot.video-take',
    target: productionContext().target,
    inputModeId: 'text-only',
    shotGroupMode: 'single-shot',
    defaultModelChoice: 'fal-ai/bytedance/seedance-2.0',
    models: [],
  };
}

function productionEstimate(): ShotVideoTakeProductionEstimateReport {
  return {
    target: productionContext().target,
    productionGroup: productionContext().productionGroup,
    inputModeId: 'text-only',
    shotGroupMode: 'single-shot',
    modelChoice: 'fal-ai/bytedance/seedance-2.0',
    estimate: null,
    issues: [],
  };
}

function productionPlan(): ShotVideoTakeProductionPlanReport {
  const context = productionContext();
  return {
    target: context.target,
    productionGroup: context.productionGroup,
    finalPrompt: null,
    plan: {
      planId: 'plan_hook',
      request: {
        projectId: 'project_hook',
        sceneId: 'scene_hook',
        shotListId: 'shot_list_hook',
        productionGroupId: 'production_group_hook',
        inputMode: 'text-only',
        shotGroupMode: 'single-shot',
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
        inputMode: 'text-only',
        shotGroupMode: 'single-shot',
        providerModel: 'bytedance/seedance-2.0/text-to-video',
        mode: 'text-to-video',
        inputRoles: [],
        parameters: [],
      },
      dependencyInventory: {
        rootPurpose: 'shot.video-take',
        rootTarget: context.target,
        dependencies: [],
        rootGeneration: {
          id: 'root:shot.video-take',
          purpose: 'shot.video-take',
          target: context.target,
          label: 'Final video take',
          mediaKind: 'video',
          pricing: { state: 'priced', estimatedUsd: 0 },
          canCreateSpec: true,
          blockedReason: null,
          estimate: null,
          diagnostics: [],
        },
        estimate: {
          state: 'complete',
          estimatedTotalUsd: 0,
          pricedDependencyCount: 0,
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
        estimatedTotalUsd: 0,
        pricedLineCount: 0,
        unpricedLineCount: 0,
        missingLineCount: 0,
        requiresPriceOverride: false,
      },
      diagnostics: [],
      finalEstimate: null,
    },
    references: {
      general: [],
      lookbook: [],
      castMembers: [],
      locations: [
        {
          locationId: 'loc_chamber',
          name: 'Council Chamber',
          selectedForShot: true,
          defaultSelectedForShot: true,
          selectedEnvironmentSheetAssetId: null,
          defaultEnvironmentSheetAssetId: null,
          selectedViewIds: [],
          environmentSheets: [
            {
              id: 'loc_chamber:planned-environment-sheet',
              locationId: 'loc_chamber',
              assetId: null,
              title: 'Council Chamber',
              selected: true,
              defaultSelected: true,
              card: {
                state: 'selected-planned',
                mediaKind: 'image',
                pricing: { state: 'not-applicable', estimatedUsd: null },
                previews: [],
                diagnostics: [],
              },
              views: [],
            },
          ],
          diagnostics: [],
        },
      ],
    },
    diagnostics: [],
  };
}
