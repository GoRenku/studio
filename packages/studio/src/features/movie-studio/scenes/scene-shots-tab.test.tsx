// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  SceneShot,
  SceneShotListDocument,
} from '@gorenku/studio-core/client';
import type { SceneShotListResourceResponse } from '@/services/studio-project-contracts';
import { readSceneShotListResource } from '@/services/studio-screenplay-api';
import { SceneShotsTab } from './scene-shots-tab';

vi.mock('@/services/studio-screenplay-api', () => ({
  readSceneShotListResource: vi.fn(),
  updateSceneShotCameraDesign: vi.fn(),
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
  });

  it('renders the empty state when there is no active shot list', async () => {
    vi.mocked(readSceneShotListResource).mockResolvedValue(resource(null));

    render(<SceneShotsTab projectName='constantinople' sceneId='scene_hook' />);

    expect(await screen.findByText('No shot list yet.')).not.toBeNull();
  });

  it('lists shots in order and updates the detail pane on selection', async () => {
    vi.mocked(readSceneShotListResource).mockResolvedValue(
      resource(shotList())
    );

    render(<SceneShotsTab projectName='constantinople' sceneId='scene_hook' />);

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
    expect(screen.getByText('Beat two.')).not.toBeNull();
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

  it('renders narrative description fields and not raw ids', async () => {
    vi.mocked(readSceneShotListResource).mockResolvedValue(
      resource(shotList())
    );

    render(<SceneShotsTab projectName='constantinople' sceneId='scene_hook' />);

    expect(await screen.findByText('Establish the obsession.')).not.toBeNull();
    expect(screen.getByText('Mehmed studies the map.')).not.toBeNull();
    expect(screen.getByText('Mehmed')).not.toBeNull();
    expect(screen.getByText('Council Chamber')).not.toBeNull();
    expect(screen.queryByText('cast_mehmed')).toBeNull();
    expect(screen.queryByText('loc_chamber')).toBeNull();
  });

  it('renders the scaffold placeholder for a not-yet-built design tab', async () => {
    vi.mocked(readSceneShotListResource).mockResolvedValue(
      resource(shotList())
    );

    render(<SceneShotsTab projectName='constantinople' sceneId='scene_hook' />);

    const locationTab = await screen.findByRole('tab', {
      name: 'Location',
    });
    // Radix Tabs use automatic activation (select on focus); jsdom clicks do
    // not move focus, so drive the focus directly.
    fireEvent.focus(locationTab);
    fireEvent.click(locationTab);
    expect(
      await screen.findByText('Designed in the shot-design surface.')
    ).not.toBeNull();
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
});

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

function shotList(): SceneShotListDocument {
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
    activeShotList,
    storyboardSheet: null,
    storyboardImagesByShotId: {},
    castMemberLabels: { cast_mehmed: 'Mehmed' },
    locationLabels: { loc_chamber: 'Council Chamber' },
  };
}
