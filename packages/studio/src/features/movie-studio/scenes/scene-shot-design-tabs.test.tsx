// @vitest-environment jsdom
import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SceneShotVideoTakeShotDesign } from '@gorenku/studio-core/client';
import { SceneShotCameraMotionTab } from './scene-shot-camera-motion-tab';
import { SceneShotCompositionTab } from './scene-shot-composition-tab';

let currentShotDesign: SceneShotVideoTakeShotDesign = {};
let updateShotDesign = vi.fn();

vi.mock('./take-shot-design-context', () => ({
  useTakeShotDesignContext: () => ({
    shotDesign: currentShotDesign,
    update: updateShotDesign,
    status: { state: 'idle', message: null },
  }),
}));

describe('Scene shot design tabs', () => {
  afterEach(() => {
    cleanup();
    currentShotDesign = {};
    updateShotDesign = vi.fn();
  });

  it.each([
    {
      name: 'shot size',
      action: () => fireEvent.click(screen.getByRole('button', { name: 'Close-Up' })),
      expected: { composition: { shotSize: 'close-up' } },
    },
    {
      name: 'subject framing with mutually exclusive headcount',
      initial: {
        composition: { subjectFraming: ['single', 'reaction'] },
      },
      action: () => fireEvent.click(screen.getByRole('button', { name: 'Two-Shot' })),
      expected: {
        composition: { subjectFraming: ['reaction', 'two-shot'] },
      },
    },
    {
      name: 'camera angle',
      action: () => fireEvent.click(screen.getByRole('button', { name: 'Low Angle' })),
      expected: { composition: { cameraAngle: 'low-angle' } },
    },
    {
      name: 'Dutch angle',
      action: () => fireEvent.click(screen.getByRole('button', { name: 'Left' })),
      expected: { composition: { dutch: 'left' } },
    },
    {
      name: 'lens type',
      action: () => fireEvent.click(screen.getByRole('button', { name: 'Normal' })),
      expected: {
        composition: {
          lens: { type: 'normal', millimeters: undefined },
        },
      },
    },
    {
      name: 'lens millimeters',
      initial: { composition: { lens: { type: 'normal' } } },
      action: () =>
        fireEvent.change(screen.getByRole('spinbutton', { name: 'Lens millimeters' }), {
          target: { value: '50' },
        }),
      expected: {
        composition: {
          lens: { type: 'normal', millimeters: 50 },
        },
      },
    },
    {
      name: 'focus',
      action: () =>
        fireEvent.click(screen.getByRole('button', { name: 'Shallow Focus' })),
      expected: { composition: { lens: { focus: 'shallow-focus' } } },
    },
    {
      name: 'rack-focus clearing paired motion',
      initial: {
        composition: { lens: { focus: 'rack-focus' } },
        motion: { movement: 'rack-focus', secondary: 'rack-focus' },
      },
      action: () => fireEvent.click(screen.getByRole('button', { name: 'Rack Focus' })),
      expected: {
        composition: { lens: { focus: undefined } },
        motion: { movement: undefined, secondary: undefined },
      },
    },
    {
      name: 'custom composition',
      action: () =>
        fireEvent.change(screen.getByPlaceholderText('Custom composition...'), {
          target: { value: 'Hold the crew against the gate edge.' },
        }),
      expected: {
        composition: {
          customComposition: 'Hold the crew against the gate edge.',
        },
      },
    },
  ] satisfies Array<{
    name: string;
    initial?: SceneShotVideoTakeShotDesign;
    action: () => void;
    expected: SceneShotVideoTakeShotDesign;
  }>)('writes composition $name into take shot design state', ({ initial, action, expected }) => {
    renderComposition(initial);

    action();

    expect(updateShotDesign).toHaveBeenCalledWith(expected);
  });

  it.each([
    {
      name: 'primary movement',
      action: () => fireEvent.click(screen.getByRole('button', { name: 'Push In' })),
      expected: { motion: { movement: 'push-in' }, composition: undefined },
    },
    {
      name: 'rack focus movement with paired focus intent',
      action: () => fireEvent.click(screen.getByRole('button', { name: 'Rack Focus' })),
      expected: {
        motion: { movement: 'rack-focus' },
        composition: { lens: { focus: 'rack-focus' } },
      },
    },
    {
      name: 'direction',
      action: () => fireEvent.click(screen.getByRole('button', { name: 'Forward' })),
      expected: { motion: { directions: ['forward'] } },
    },
    {
      name: 'direction toggle removal',
      initial: { motion: { directions: ['forward', 'up'] } },
      action: () => fireEvent.click(screen.getByRole('button', { name: 'Forward' })),
      expected: { motion: { directions: ['up'] } },
    },
    {
      name: 'track',
      action: () => fireEvent.click(screen.getByRole('button', { name: 'Circular' })),
      expected: { motion: { track: 'circular' } },
    },
    {
      name: 'rig',
      action: () => fireEvent.click(screen.getByRole('button', { name: 'Gimbal' })),
      expected: { motion: { rig: 'gimbal' } },
    },
    {
      name: 'custom motion',
      action: () =>
        fireEvent.change(screen.getByPlaceholderText(/Custom motion/), {
          target: { value: 'Float upward after the impact lands.' },
        }),
      expected: {
        motion: { customMotion: 'Float upward after the impact lands.' },
      },
    },
  ] satisfies Array<{
    name: string;
    initial?: SceneShotVideoTakeShotDesign;
    action: () => void;
    expected: SceneShotVideoTakeShotDesign;
  }>)('writes motion $name into take shot design state', ({ initial, action, expected }) => {
    renderMotion(initial);

    action();

    expect(updateShotDesign).toHaveBeenCalledWith(expected);
  });
});

function renderComposition(initial: SceneShotVideoTakeShotDesign = {}) {
  currentShotDesign = initial;
  updateShotDesign = vi.fn();
  render(<SceneShotCompositionTab />);
}

function renderMotion(initial: SceneShotVideoTakeShotDesign = {}) {
  currentShotDesign = initial;
  updateShotDesign = vi.fn();
  render(<SceneShotCameraMotionTab />);
}
