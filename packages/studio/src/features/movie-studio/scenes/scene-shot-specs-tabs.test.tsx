// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  SceneShot,
  ShotVideoTakeProductionPlanReport,
} from '@gorenku/studio-core/client';
import type {
  SceneShotListResourceResponse,
} from '@/services/studio-project-contracts';
import { updateSceneShotSpecs } from '@/services/studio-screenplay-api';
import { updateShotLocationReference } from '@/services/studio-shot-video-takes-api';
import { SceneShotCompositionTab } from './scene-shot-composition-tab';
import { SceneShotCameraMotionTab } from './scene-shot-camera-motion-tab';
import { SceneShotDetail } from './scene-shot-detail';
import { SceneShotLocationTab } from './scene-shot-location-tab';
import { ShotSpecsProvider } from './shot-specs-context';

vi.mock('@/services/studio-screenplay-api', () => ({
  updateSceneShotSpecs: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/services/studio-project-assets-api', () => ({
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
  updateShotLocationReference: vi.fn().mockResolvedValue({
    resource: {},
    resourceKeys: [],
  }),
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
  storyBeat: 'beat',
  narrativePurpose: 'purpose',
  description: 'description',
  shotType: 'wide',
  subject: 'subject',
  action: 'action',
  dialogue: [],
  coveredBlockIndexes: [0],
  castMemberIds: [],
  locationIds: [],
};

function renderWithProvider(
  children: React.ReactNode,
  options: {
    shot?: SceneShot;
    onSaved?: (resource: SceneShotListResourceResponse) => void;
  } = {}
) {
  return render(
    <ShotSpecsProvider
      projectName='constantinople'
      sceneId='scene_hook'
      shot={options.shot ?? SHOT}
      onSaved={options.onSaved}
    >
      {children}
    </ShotSpecsProvider>
  );
}

function pressed(name: string): boolean {
  return (
    screen.getByRole('button', { name }).getAttribute('aria-pressed') === 'true'
  );
}

function locationProductionPlan(): ShotVideoTakeProductionPlanReport {
  return {
    target: {
      kind: 'sceneShotGroup',
      id: 'scene-shot-group',
      sceneId: 'scene_hook',
      shotListId: 'shot_list_hook',
      productionGroupId: 'production_group_hook',
      shotIds: ['shot_001'],
    },
    productionGroup: {
      productionGroupId: 'production_group_hook',
      shotIds: ['shot_001'],
      videoTakeProduction: {},
    },
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
      dependencyMap: {
        rootPurpose: 'shot.video-take',
        nodes: [],
        edges: [],
        estimate: {
          state: 'complete',
          estimatedTotalUsd: 0,
          pricedNodeCount: 0,
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
        estimatedTotalUsd: 0,
        pricedLineCount: 0,
        unpricedLineCount: 0,
        missingLineCount: 0,
        requiresPriceOverride: false,
      },
      diagnostics: [],
      finalEstimate: null,
    },
    castReferences: [],
    locationReferences: [
      {
        locationId: 'location_gate',
        name: 'Sea Gate',
        selected: true,
        defaultSelected: true,
        environmentSheet: {
          state: 'selected-ready',
          mediaKind: 'image',
          pricing: { state: 'not-applicable', estimatedUsd: null },
          previews: [],
          diagnostics: [],
        },
        viewChoices: [
          {
            viewId: 'front',
            label: 'Front',
            selected: true,
            preview: {
              assetId: 'asset_location_environment_sheet',
              assetFileId: 'asset_file_location_view_front',
              projectRelativePath: 'locations/sea-gate/sheet-front.png' as never,
              title: 'Front',
              alt: 'Front',
            },
          },
        ],
      },
      {
        locationId: 'location_harbor',
        name: 'Golden Horn',
        selected: false,
        defaultSelected: false,
        environmentSheet: {
          state: 'available',
          mediaKind: 'image',
          pricing: { state: 'not-applicable', estimatedUsd: null },
          previews: [],
          diagnostics: [],
        },
        viewChoices: [],
      },
    ],
    lookbookReferences: [],
    imageReferences: [],
    diagnostics: [],
  };
}

describe('SceneShotDetail', () => {
  it('shows the shot-design tabs without Camera Framing or Camera Type', () => {
    render(
      <SceneShotDetail
        projectName='constantinople'
        sceneId='scene_hook'
        shot={SHOT}
        shots={[SHOT]}
        productionGroups={[]}
        label='Shot 1'
        castMemberLabels={{}}
        locationLabels={{}}
      />
    );

    expect(screen.getByRole('tab', { name: 'Description' })).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'Lookbook' })).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'Composition' })).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'Motion' })).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'Cast' })).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'Location' })).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'References' })).not.toBeNull();
    expect(screen.queryByRole('tab', { name: 'Camera Motion' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Camera Framing' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Camera Type' })).toBeNull();
  });
});

describe('SceneShotCompositionTab', () => {
  beforeEach(() => {
    vi.mocked(updateSceneShotSpecs).mockClear();
  });

  it('treats shot size as a single-select ladder', () => {
    renderWithProvider(<SceneShotCompositionTab />);

    fireEvent.click(screen.getByRole('button', { name: 'Close-Up' }));
    expect(pressed('Close-Up')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Medium Shot' }));
    expect(pressed('Medium Shot')).toBe(true);
    expect(pressed('Close-Up')).toBe(false);
  });

  it('keeps pill toggles on the compact shot specs styling', () => {
    renderWithProvider(<SceneShotCompositionTab />);

    const noneToggle = screen.getByRole('button', { name: 'None' });
    expect(noneToggle.className).toContain('px-3');
    expect(noneToggle.className).toContain('py-1.5');
    expect(noneToggle.className).toContain('text-xs');
    expect(noneToggle.className).not.toContain('h-9');
    expect(noneToggle.className).not.toContain('shadow');
    expect(noneToggle.className).not.toContain('text-primary-foreground');
  });

  it('keeps subject-framing headcount mutually exclusive while layering OTS on top', () => {
    renderWithProvider(<SceneShotCompositionTab />);

    fireEvent.click(screen.getByRole('button', { name: 'Single' }));
    fireEvent.click(screen.getByRole('button', { name: 'Over Shoulder' }));
    expect(pressed('Single')).toBe(true);
    expect(pressed('Over Shoulder')).toBe(true);

    // Selecting another headcount replaces the first; OTS persists.
    fireEvent.click(screen.getByRole('button', { name: 'Two-Shot' }));
    expect(pressed('Two-Shot')).toBe(true);
    expect(pressed('Single')).toBe(false);
    expect(pressed('Over Shoulder')).toBe(true);
  });

  it('persists the structured composition selection via autosave', async () => {
    renderWithProvider(<SceneShotCompositionTab />);

    fireEvent.click(screen.getByRole('button', { name: 'Medium Close-Up' }));

    await waitFor(
      () => {
        expect(updateSceneShotSpecs).toHaveBeenCalledWith(
          'constantinople',
          'scene_hook',
          'shot_001',
          expect.objectContaining({ shotSize: 'medium-close-up' })
        );
      },
      { timeout: 2000 }
    );
  });

  it('publishes the saved shot-list resource after autosave', async () => {
    const savedResource = sceneShotListResource({
      ...SHOT,
      shotSpecs: { shotSize: 'medium-close-up' },
    });
    vi.mocked(updateSceneShotSpecs).mockResolvedValueOnce(savedResource);
    const onSaved = vi.fn();
    renderWithProvider(<SceneShotCompositionTab />, { onSaved });

    fireEvent.click(screen.getByRole('button', { name: 'Medium Close-Up' }));

    await waitFor(
      () => {
        expect(onSaved).toHaveBeenCalledWith(savedResource);
      },
      { timeout: 2000 }
    );
  });

  it('persists lens and focus selections via autosave', async () => {
    renderWithProvider(<SceneShotCompositionTab />);

    fireEvent.click(screen.getByRole('button', { name: 'Wide' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Lens millimeters' }), {
      target: { value: '28' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Shallow Focus' }));

    await waitFor(
      () => {
        expect(updateSceneShotSpecs).toHaveBeenLastCalledWith(
          'constantinople',
          'scene_hook',
          'shot_001',
          expect.objectContaining({
            lens: expect.objectContaining({
              type: 'wide',
              millimeters: 28,
              focus: 'shallow-focus',
            }),
          })
        );
      },
      { timeout: 2000 }
    );
  });

  it('clearing the last specs field sends null shot specs', async () => {
    renderWithProvider(<SceneShotCompositionTab />, {
      shot: {
        ...SHOT,
        shotSpecs: { shotSize: 'close-up' },
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Close-Up' }));

    await waitFor(
      () => {
        expect(updateSceneShotSpecs).toHaveBeenCalledWith(
          'constantinople',
          'scene_hook',
          'shot_001',
          null
        );
      },
      { timeout: 2000 }
    );
  });
});

describe('SceneShotCameraMotionTab', () => {
  beforeEach(() => {
    vi.mocked(updateSceneShotSpecs).mockClear();
  });

  it('persists movement, direction, track, and rig selections', async () => {
    renderWithProvider(<SceneShotCameraMotionTab />);

    fireEvent.click(screen.getByRole('button', { name: 'Push In' }));
    fireEvent.click(screen.getByRole('button', { name: 'Forward' }));
    fireEvent.click(screen.getByRole('button', { name: 'Straight' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dolly' }));

    expect(pressed('Push In')).toBe(true);
    expect(pressed('Forward')).toBe(true);
    expect(pressed('Straight')).toBe(true);
    expect(pressed('Dolly')).toBe(true);

    await waitFor(
      () => {
        expect(updateSceneShotSpecs).toHaveBeenLastCalledWith(
          'constantinople',
          'scene_hook',
          'shot_001',
          expect.objectContaining({
            movement: expect.objectContaining({
              movement: 'push-in',
              directions: ['forward'],
              track: 'straight',
              rig: 'dolly',
            }),
          })
        );
      },
      { timeout: 2000 }
    );
  });
});

describe('SceneShotLocationTab', () => {
  beforeEach(() => {
    vi.mocked(updateSceneShotSpecs).mockClear();
    vi.mocked(updateShotLocationReference).mockClear();
  });

  it('persists the selected shot location', async () => {
    renderWithProvider(
      <SceneShotLocationTab
        projectName='constantinople'
        sceneId='scene_hook'
        shot={{
          ...SHOT,
          locationIds: ['location_gate', 'location_harbor'],
        }}
        productionPlan={locationProductionPlan()}
      />,
      {
        shot: {
          ...SHOT,
          locationIds: ['location_gate', 'location_harbor'],
        },
      }
    );

    fireEvent.click(screen.getByRole('button', { name: 'Golden Horn' }));

    await waitFor(
      () => {
        expect(updateShotLocationReference).toHaveBeenLastCalledWith(
          'constantinople',
          'scene_hook',
          'shot_001',
          { locationId: 'location_harbor' }
        );
      },
      { timeout: 2000 }
    );
  });

  it('renders environment views without raw ids or filenames on visual cards', async () => {
    renderWithProvider(
      <SceneShotLocationTab
        projectName='constantinople'
        sceneId='scene_hook'
        shot={{ ...SHOT, locationIds: ['location_gate'] }}
        productionPlan={locationProductionPlan()}
      />,
      {
        shot: { ...SHOT, locationIds: ['location_gate'] },
      }
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Front/i })).not.toBeNull();
    });

    expect(screen.queryByText(/asset_location_environment_sheet/i)).toBeNull();
    expect(screen.queryByText(/asset_file_location_view_front/i)).toBeNull();
    expect(screen.queryByText(/sheet-front\.png/i)).toBeNull();
  });
});

describe('shared shot specs state across tabs', () => {
  beforeEach(() => {
    vi.mocked(updateSceneShotSpecs).mockClear();
  });

  it('does not let one tab clobber the other tab’s selections', async () => {
    // Both tabs share one provider, mirroring the live layout.
    renderWithProvider(
      <>
        <SceneShotCompositionTab />
        <SceneShotCameraMotionTab />
      </>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close-Up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tracking' }));

    await waitFor(
      () => {
        expect(updateSceneShotSpecs).toHaveBeenLastCalledWith(
          'constantinople',
          'scene_hook',
          'shot_001',
          expect.objectContaining({
            shotSize: 'close-up',
            movement: expect.objectContaining({ movement: 'tracking' }),
          })
        );
      },
      { timeout: 2000 }
    );
  });
});

function sceneShotListResource(
  shot: SceneShot
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
    activeShotListId: 'shot_list_hook',
    activeShotList: {
      kind: 'sceneShotList',
      sceneId: 'scene_hook',
      title: 'Council chamber coverage',
      summary: 'A restrained coverage plan.',
      coverageStrategy: 'Hold the table in one composed frame.',
      shots: [shot],
    },
    storyboardSheet: null,
    storyboardImagesByShotId: {},
    castMemberLabels: {},
    locationLabels: {},
  };
}
