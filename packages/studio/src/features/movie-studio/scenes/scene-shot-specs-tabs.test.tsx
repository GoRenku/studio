// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  SceneShot,
} from '@gorenku/studio-core/client';
import type {
  SceneShotListResourceResponse,
} from '@/services/studio-project-contracts';
import { updateSceneShotSpecs } from '@/services/studio-screenplay-api';
import type { SaveNotificationStatus } from '@/ui/save-notification';
import { SceneShotCompositionTab } from './scene-shot-composition-tab';
import { SceneShotCameraMotionTab } from './scene-shot-camera-motion-tab';
import { SceneShotDetail } from './scene-shot-detail';
import { ShotSpecsProvider } from './shot-specs-context';

vi.mock('@/services/studio-screenplay-api', () => ({
  updateSceneShotSpecs: vi.fn().mockResolvedValue({}),
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
    onSaveNotificationChange?: (status: SaveNotificationStatus) => void;
  } = {}
) {
  return render(
    <ShotSpecsProvider
      projectName='constantinople'
      sceneId='scene_hook'
      shot={options.shot ?? SHOT}
      onSaved={options.onSaved}
      onSaveNotificationChange={options.onSaveNotificationChange}
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

describe('SceneShotDetail', () => {
  it('shows the shot-design tabs without Camera Framing or Camera Type', () => {
    render(
      <SceneShotDetail
        projectName='constantinople'
        sceneId='scene_hook'
        shot={SHOT}
        takeGeneration={null}
        label='Shot 1'
        castMemberLabels={{}}
        locationLabels={{}}
      />
    );

    expect(screen.getByRole('tab', { name: 'Description' })).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'Composition' })).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'Motion' })).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'References' })).not.toBeNull();
    expect(screen.queryByRole('tab', { name: 'Lookbook' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Cast' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Location' })).toBeNull();
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

    const shotSizeButtons = screen
      .getAllByRole('button')
      .filter((button) =>
        [
          'Extreme Close-Up',
          'Close-Up',
          'Medium Close-Up',
          'Medium Shot',
          'Medium Full',
          'Full Shot',
          'Wide Shot',
          'Extreme Wide',
          'Establishing Shot',
        ].includes(button.textContent ?? '')
      );
    expect(shotSizeButtons.map((button) => button.textContent)).toEqual([
      'Extreme Close-Up',
      'Close-Up',
      'Medium Close-Up',
      'Medium Shot',
      'Medium Full',
      'Full Shot',
      'Wide Shot',
      'Extreme Wide',
      'Establishing Shot',
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Close-Up' }));
    expect(pressed('Close-Up')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Establishing Shot' }));
    expect(pressed('Establishing Shot')).toBe(true);
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

    fireEvent.click(screen.getByRole('button', { name: 'Establishing Shot' }));

    await waitFor(
      () => {
        expect(updateSceneShotSpecs).toHaveBeenCalledWith(
          'constantinople',
          'scene_hook',
          'shot_001',
          expect.objectContaining({ shotSize: 'establishing-shot' })
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

  it('reports shot specs save status to the details header path', async () => {
    const onSaveNotificationChange = vi.fn();
    renderWithProvider(<SceneShotCompositionTab />, {
      onSaveNotificationChange,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Medium Close-Up' }));

    await waitFor(
      () => {
        expect(onSaveNotificationChange).toHaveBeenCalledWith({
          state: 'saved',
          message: 'Saved',
        });
      },
      { timeout: 2000 }
    );
    expect(screen.queryByRole('status')).toBeNull();
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
    storyboardImagesByShotId: {},
    castMemberLabels: {},
    castMemberImages: {},
    locationLabels: {},
  };
}
