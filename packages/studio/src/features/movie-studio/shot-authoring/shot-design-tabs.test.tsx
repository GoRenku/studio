// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShotDirectionDraft } from '@gorenku/studio-core/client';
import { ShotCompositionTab } from './shot-composition-tab';
import { ShotDirectionProvider } from './shot-direction-context';
import { ShotMotionTab } from './shot-motion-tab';

describe('Shot authoring design tabs', () => {
  afterEach(cleanup);

  it.each([
    {
      name: 'shot size',
      action: () => fireEvent.click(screen.getByRole('button', { name: 'Close-Up' })),
      expected: { composition: { shotSize: 'close-up' } },
    },
    {
      name: 'subject framing',
      initial: { composition: { subjectFraming: ['single', 'reaction'] } },
      action: () => fireEvent.click(screen.getByRole('button', { name: 'Two-Shot' })),
      expected: { composition: { subjectFraming: ['reaction', 'two-shot'] } },
    },
    {
      name: 'lens',
      action: () => fireEvent.click(screen.getByRole('button', { name: 'Normal' })),
      expected: { composition: { lens: { type: 'normal', millimeters: undefined } } },
    },
    {
      name: 'rack focus',
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
  ] satisfies Array<{
    name: string;
    initial?: ShotDirectionDraft;
    action: () => void;
    expected: ShotDirectionDraft;
  }>)('writes composition $name into controlled state', ({ initial = {}, action, expected }) => {
    const onChange = vi.fn();
    render(
      <ShotDirectionProvider direction={initial} onChange={onChange}>
        <ShotCompositionTab />
      </ShotDirectionProvider>
    );
    action();
    expect(onChange).toHaveBeenCalledWith(expected);
  });

  it.each([
    {
      name: 'movement',
      action: () => fireEvent.click(screen.getByRole('button', { name: 'Push In' })),
      expected: { motion: { movement: 'push-in' }, composition: undefined },
    },
    {
      name: 'direction',
      action: () => fireEvent.click(screen.getByRole('button', { name: 'Forward' })),
      expected: { motion: { directions: ['forward'] } },
    },
    {
      name: 'rig',
      action: () => fireEvent.click(screen.getByRole('button', { name: 'Gimbal' })),
      expected: { motion: { rig: 'gimbal' } },
    },
  ] satisfies Array<{
    name: string;
    action: () => void;
    expected: ShotDirectionDraft;
  }>)('writes motion $name into controlled state', ({ action, expected }) => {
    const onChange = vi.fn();
    render(
      <ShotDirectionProvider direction={{}} onChange={onChange}>
        <ShotMotionTab />
      </ShotDirectionProvider>
    );
    action();
    expect(onChange).toHaveBeenCalledWith(expected);
  });
});
