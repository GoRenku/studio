// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioWaveformPlayer } from './audio-waveform-player';

describe('AudioWaveformPlayer', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
  });

  it('stretches the waveform and highlights elapsed playback', () => {
    const { container } = render(
      <AudioWaveformPlayer
        src='/audio/turn-1.mp3'
        durationSeconds={10}
        label='Turn 1'
      />,
    );
    const audio = container.querySelector('audio');
    if (!audio) throw new Error('Expected an audio element.');
    Object.defineProperty(audio, 'currentTime', { value: 5, writable: true });

    fireEvent.timeUpdate(audio);

    const progress = container.querySelector<HTMLElement>('[data-audio-waveform-progress]');
    const base = container.querySelector<HTMLElement>('[data-audio-waveform-layer="base"]');
    expect(progress?.style.clipPath).toBe('inset(0 50% 0 0)');
    expect(progress?.className).toContain('w-full');
    expect(progress?.querySelectorAll('span')).toHaveLength(144);
    expect(progress?.querySelector('span')?.className).toContain('w-px');
    expect(progress?.querySelector('span')?.className).not.toContain('flex-1');
    expect(
      new Set(Array.from(base?.querySelectorAll('span') ?? [], (bar) => bar.getAttribute('style'))).size,
    ).toBeGreaterThan(20);
    expect(
      Array.from(base?.querySelectorAll('span') ?? [], (bar) => bar.getAttribute('style')),
    ).toEqual(
      Array.from(progress?.querySelectorAll('span') ?? [], (bar) => bar.getAttribute('style')),
    );
    expect(screen.getByText('0:05 / 0:10')).toBeTruthy();
  });
});
