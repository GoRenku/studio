// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SceneShot } from '@gorenku/studio-core/client';
import type { SceneShotListResourceResponse } from '@/services/studio-project-contracts';
import { updateSceneShotCameraDesign } from '@/services/studio-screenplay-api';
import { SceneShotCameraFramingTab } from './scene-shot-camera-framing-tab';
import { SceneShotCameraMotionTab } from './scene-shot-camera-motion-tab';
import { ShotCameraDesignProvider } from './shot-camera-design-context';

vi.mock('@/services/studio-screenplay-api', () => ({
  updateSceneShotCameraDesign: vi.fn().mockResolvedValue({}),
}));

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
    <ShotCameraDesignProvider
      projectName='constantinople'
      sceneId='scene_hook'
      shot={options.shot ?? SHOT}
      onSaved={options.onSaved}
    >
      {children}
    </ShotCameraDesignProvider>
  );
}

function pressed(name: string): boolean {
  return (
    screen.getByRole('button', { name }).getAttribute('aria-pressed') === 'true'
  );
}

describe('SceneShotCameraFramingTab', () => {
  beforeEach(() => {
    vi.mocked(updateSceneShotCameraDesign).mockClear();
  });

  it('treats shot size as a single-select ladder', () => {
    renderWithProvider(<SceneShotCameraFramingTab />);

    fireEvent.click(screen.getByRole('button', { name: 'Close-Up' }));
    expect(pressed('Close-Up')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Medium Shot' }));
    expect(pressed('Medium Shot')).toBe(true);
    expect(pressed('Close-Up')).toBe(false);
  });

  it('keeps pill toggles on the compact camera-design styling', () => {
    renderWithProvider(<SceneShotCameraFramingTab />);

    const noneToggle = screen.getByRole('button', { name: 'None' });
    expect(noneToggle.className).toContain('px-3');
    expect(noneToggle.className).toContain('py-1.5');
    expect(noneToggle.className).toContain('text-xs');
    expect(noneToggle.className).not.toContain('h-9');
    expect(noneToggle.className).not.toContain('shadow');
    expect(noneToggle.className).not.toContain('text-primary-foreground');
  });

  it('keeps subject-framing headcount mutually exclusive while layering OTS on top', () => {
    renderWithProvider(<SceneShotCameraFramingTab />);

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

  it('persists the structured framing selection via autosave', async () => {
    renderWithProvider(<SceneShotCameraFramingTab />);

    fireEvent.click(screen.getByRole('button', { name: 'Medium Close-Up' }));

    await waitFor(
      () => {
        expect(updateSceneShotCameraDesign).toHaveBeenCalledWith(
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
      cameraDesign: { shotSize: 'medium-close-up' },
    });
    vi.mocked(updateSceneShotCameraDesign).mockResolvedValueOnce(savedResource);
    const onSaved = vi.fn();
    renderWithProvider(<SceneShotCameraFramingTab />, { onSaved });

    fireEvent.click(screen.getByRole('button', { name: 'Medium Close-Up' }));

    await waitFor(
      () => {
        expect(onSaved).toHaveBeenCalledWith(savedResource);
      },
      { timeout: 2000 }
    );
  });
});

describe('SceneShotCameraMotionTab', () => {
  beforeEach(() => {
    vi.mocked(updateSceneShotCameraDesign).mockClear();
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
        expect(updateSceneShotCameraDesign).toHaveBeenLastCalledWith(
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

describe('shared camera-design state across tabs', () => {
  beforeEach(() => {
    vi.mocked(updateSceneShotCameraDesign).mockClear();
  });

  it('does not let one tab clobber the other tab’s selections', async () => {
    // Both tabs share one provider, mirroring the live layout.
    renderWithProvider(
      <>
        <SceneShotCameraFramingTab />
        <SceneShotCameraMotionTab />
      </>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close-Up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tracking' }));

    await waitFor(
      () => {
        expect(updateSceneShotCameraDesign).toHaveBeenLastCalledWith(
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
