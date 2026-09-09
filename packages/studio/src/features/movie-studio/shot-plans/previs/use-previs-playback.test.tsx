// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { usePrevisPlayback } from './use-previs-playback';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('links elapsed seconds, holds a shorter take, auditions a bounded cue and applies mute', async () => {
  let tick: FrameRequestCallback = () => {};
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { tick = callback; return 1; });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  let clock = 0;
  const previs = { play: vi.fn(async () => {}), pause: vi.fn(), seek: vi.fn((time: number) => { clock = time; }), setMuted: vi.fn(), getCurrentTime: () => clock };
  const generation = { ...previs, play: vi.fn(async () => {}), pause: vi.fn(), seek: vi.fn(), setMuted: vi.fn() };
  const { result } = renderHook(() => usePrevisPlayback('/take.mp4'));
  act(() => {
    result.current.attachPrevis(previs);
    result.current.attachGeneration(generation);
    result.current.onPrevisDuration(10);
    result.current.onGenerationDuration(5);
  });
  expect(result.current.time).toBe(0);
  expect(result.current.playing).toBe(false);
  act(() => result.current.seek(3));
  expect(generation.seek).toHaveBeenLastCalledWith(3);
  await act(async () => result.current.toggle());
  expect(previs.play).toHaveBeenCalled();
  expect(generation.play).toHaveBeenCalled();
  expect(previs.setMuted).toHaveBeenLastCalledWith(true);
  expect(generation.setMuted).toHaveBeenLastCalledWith(false);
  act(() => { clock = 6; tick(1); });
  expect(generation.pause).toHaveBeenCalled();
  expect(result.current.playing).toBe(true);
  act(() => result.current.toggleMute());
  expect(generation.setMuted).toHaveBeenLastCalledWith(true);
  await act(async () => result.current.playCue({ startSeconds: 2, endSeconds: 4, text: 'Door closes' }, 0));
  act(() => { clock = 4.1; tick(2); });
  expect(result.current.playing).toBe(false);
  expect(result.current.time).toBe(4);
  await act(async () => result.current.playCue({ startSeconds: 2, endSeconds: 4, text: 'Door closes' }, 0));
  expect(result.current.playing).toBe(true);
  // A refreshed report supplies new cue objects for the same authored position.
  await act(async () => result.current.playCue({ startSeconds: 2, endSeconds: 4, text: 'Door closes' }, 0));
  expect(result.current.playing).toBe(false);
});

it('plays the exact recording offset, seeks within it and restores ordinary audio after audition', async () => {
  const recording = { currentTime: 0, muted: false, pause: vi.fn(), play: vi.fn(async () => {}), onended: null as (() => void) | null };
  const AudioMock = vi.fn(function () { return recording; });
  vi.stubGlobal('Audio', AudioMock);
  const player = { play: vi.fn(async () => {}), pause: vi.fn(), seek: vi.fn(), setMuted: vi.fn(), getCurrentTime: () => 0 };
  const { result } = renderHook(() => usePrevisPlayback());
  act(() => { result.current.attachPrevis(player); result.current.onPrevisDuration(12); });
  await act(async () => result.current.playCue({ startSeconds: 3, endSeconds: 7, text: 'Voice', audio: { assetId: 'a', assetFileId: 'f', offsetSeconds: 2, url: '/exact/audio' } }, 0));
  expect(AudioMock).toHaveBeenCalledWith('/exact/audio');
  expect(recording.currentTime).toBe(2);
  expect(player.setMuted).toHaveBeenLastCalledWith(true);
  act(() => result.current.seek(5));
  expect(recording.currentTime).toBe(4);
  act(() => recording.onended?.());
  expect(result.current.playing).toBe(false);
  expect(player.setMuted).toHaveBeenLastCalledWith(false);
  vi.unstubAllGlobals();
});
