// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MonitorTransport } from './transport';
import { clipPlaybackSequence } from './clip-playback-sequence';
import { rawClipFixture } from './clip-playback-fixtures';

beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('shows consecutive proportional clip colors without duplicate navigation buttons', () => {
  const segments = clipPlaybackSequence(rawClipFixture([3, 9]), {});
  const { container } = render(<MonitorTransport label='Generation' time={5} duration={12}
    playing={false} muted={false} toggle={vi.fn()} seek={vi.fn()} toggleMute={vi.fn()}
    segments={segments} />);
  const first = container.querySelector('[data-clip-number="1"]') as HTMLElement;
  const second = container.querySelector('[data-clip-number="2"]') as HTMLElement;
  expect(first.style.width).toBe('25%');
  expect(second.style.left).toBe('25%');
  expect(second.style.width).toBe('75%');
  expect(first.className).not.toBe(second.className);
  expect(screen.getByRole('slider', { name: 'Generation timeline' }).getAttribute('aria-valuemax')).toBe('12');
  expect(screen.queryByRole('button', { name: /Go to Clip/ })).toBeNull();
});

it('does not paint a later clip as playable across a missing selection', () => {
  const report = rawClipFixture([3, 9, 2]);
  report.clips[1]!.selectedTakeId = null;
  const { container } = render(<MonitorTransport label='Generation' time={0} duration={3}
    playing={false} muted={false} toggle={vi.fn()} seek={vi.fn()} toggleMute={vi.fn()}
    segments={clipPlaybackSequence(report, {})} />);
  expect(container.querySelectorAll('[data-clip-number]')).toHaveLength(1);

});

it('cycles three section colors after the third clip', () => {
  const { container } = render(<MonitorTransport label='Generation' time={0} duration={4}
    playing={false} muted={false} toggle={vi.fn()} seek={vi.fn()} toggleMute={vi.fn()}
    segments={clipPlaybackSequence(rawClipFixture([1, 1, 1, 1]), {})} />);
  const sections = [...container.querySelectorAll('[data-clip-number]')];
  expect(new Set(sections.slice(0, 3).map((section) => section.className)).size).toBe(3);
  expect(sections[3]!.className).toBe(sections[0]!.className);
});
