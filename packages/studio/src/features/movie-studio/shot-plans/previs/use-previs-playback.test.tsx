// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { VideoPlayer } from '@/ui/video-player';
import type { StudioPrevisDialogue, StudioPrevisPlayback } from '@/services/shot-plan-previs/contracts';
import { usePrevisPlayback } from './use-previs-playback';

const timeline: StudioPrevisPlayback = { frameRate: { numerator: 24, denominator: 1 }, frameCount: 288, subjects: [], segments: [{ id: 'wide', label: 'Wide', startFrame: 0 }, { id: 'close', label: 'Close', startFrame: 72 }], cues: [] };
const dialogue = (id: string, start: number, end: number, text = 'Voice'): StudioPrevisDialogue => ({ id, kind: 'dialogue', speaker: 'speaker', startFrame: start * 24, endFrame: end * 24, text });

vi.mock('@/ui/slider', () => ({ Slider: () => null }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('links elapsed seconds, holds a shorter take, auditions a bounded cue and applies mute', async () => {
  let tick: FrameRequestCallback = () => {};
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { tick = callback; return 1; });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  let clock = 0;
  const previs = { play: vi.fn(async () => {}), pause: vi.fn(), seek: vi.fn((time: number) => { clock = time; }), setMuted: vi.fn(), getCurrentTime: () => clock };
  const generation = { ...previs, play: vi.fn(async () => {}), pause: vi.fn(), seek: vi.fn(), setMuted: vi.fn() };
  const { result } = renderHook(() => usePrevisPlayback('/take.mp4', timeline));
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
  await act(async () => result.current.playDialogue(dialogue('door', 2, 4)));
  act(() => { clock = 4.1; tick(2); });
  expect(result.current.playing).toBe(false);
  expect(result.current.time).toBe(4);
  await act(async () => result.current.playDialogue(dialogue('door', 2, 4)));
  expect(result.current.playing).toBe(true);
  // A refreshed report supplies new cue objects for the same authored position.
  await act(async () => result.current.playDialogue(dialogue('door', 2, 4)));
  expect(result.current.playing).toBe(false);
});

it('plays the exact recording offset, seeks within it and restores ordinary audio after audition', async () => {
  const recording = { currentTime: 0, muted: false, pause: vi.fn(), play: vi.fn(async () => {}), onended: null as (() => void) | null };
  const AudioMock = vi.fn(function () { return recording; });
  vi.stubGlobal('Audio', AudioMock);
  const player = { play: vi.fn(async () => {}), pause: vi.fn(), seek: vi.fn(), setMuted: vi.fn(), getCurrentTime: () => 0 };
  const { result } = renderHook(() => usePrevisPlayback(undefined, timeline));
  act(() => { result.current.attachPrevis(player); result.current.onPrevisDuration(12); });
  await act(async () => result.current.playDialogue({ ...dialogue('voice', 3, 7), audio: { assetId: 'a', assetFileId: 'f', offsetSeconds: 2, url: '/exact/audio' } }));
  expect(AudioMock).toHaveBeenCalledWith('/exact/audio');
  expect(recording.currentTime).toBe(2);
  expect(player.setMuted).toHaveBeenLastCalledWith(true);
  act(() => result.current.seek(5));
  expect(recording.pause).toHaveBeenCalled();
  expect(result.current.activeCue).toBeNull();
  act(() => recording.onended?.());
  expect(result.current.playing).toBe(false);
  expect(player.setMuted).toHaveBeenLastCalledWith(false);
  vi.unstubAllGlobals();
});

it.each([
  { playing: true, time: 3, starts: true },
  { playing: false, time: 3, starts: false },
  { playing: true, time: 5, starts: false },
  { playing: true, time: 6, starts: false },
])('joins late-loading Generation at $time seconds while playing=$playing', async ({ playing, time, starts }) => {
  const previs = { play: vi.fn(async () => {}), pause: vi.fn(), seek: vi.fn(), setMuted: vi.fn(), getCurrentTime: () => time };
  const generation = { ...previs, play: vi.fn(async () => {}), seek: vi.fn(), setMuted: vi.fn() };
  const { result } = renderHook(() => usePrevisPlayback('/take.mp4', timeline));
  act(() => {
    result.current.attachPrevis(previs);
    result.current.attachGeneration(generation);
    result.current.onPrevisDuration(12);
  });
  if (playing) await act(async () => result.current.toggle());
  expect(generation.play).not.toHaveBeenCalled();
  expect(previs.setMuted).toHaveBeenLastCalledWith(false);
  await act(async () => result.current.onGenerationDuration(5));
  expect(generation.seek).toHaveBeenLastCalledWith(time);
  expect(generation.play).toHaveBeenCalledTimes(starts ? 1 : 0);
  expect(result.current.playing).toBe(playing);
  expect(previs.setMuted).toHaveBeenLastCalledWith(true);
  expect(generation.setMuted).toHaveBeenLastCalledWith(false);
});

it.each([false, true])('handles a late Generation play rejection after interruption=%s', async (interrupted) => {
  let rejectPlay!: (reason: Error) => void;
  const pendingPlay = new Promise<void>((_resolve, reject) => { rejectPlay = reject; });
  const previs = { play: vi.fn(async () => {}), pause: vi.fn(), seek: vi.fn(), setMuted: vi.fn(), getCurrentTime: () => 3 };
  const generation = { ...previs, play: vi.fn(() => pendingPlay), setMuted: vi.fn() };
  const { result } = renderHook(() => usePrevisPlayback('/take.mp4', timeline));
  act(() => {
    result.current.attachPrevis(previs);
    result.current.attachGeneration(generation);
    result.current.onPrevisDuration(12);
  });
  await act(async () => result.current.toggle());
  act(() => result.current.onGenerationDuration(5));
  expect(generation.play).toHaveBeenCalledOnce();
  if (interrupted) act(() => result.current.pause());
  await act(async () => rejectPlay(new DOMException('Playback denied', 'NotAllowedError')));
  expect(result.current.playing).toBe(!interrupted);
  expect(result.current.error).toBe(interrupted ? null : 'Generation playback is unavailable. Previs playback remains available.');
  expect(previs.setMuted).toHaveBeenLastCalledWith(interrupted);
});

it.each(['Previs', 'Generation'])('keeps the new cue through queued media events and follows %s controls', async (title) => {
  const mediaEvents: Array<() => void> = [];
  const playingMedia = new WeakSet<HTMLMediaElement>();
  vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockImplementation(function (this: HTMLMediaElement) { return !playingMedia.has(this); });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(async function (this: HTMLMediaElement) {
    if (playingMedia.has(this)) return;
    playingMedia.add(this);
    mediaEvents.push(() => this.dispatchEvent(new Event('play')));
  });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
    if (!playingMedia.delete(this)) return;
    mediaEvents.push(() => this.dispatchEvent(new Event('pause')));
  });
  let tick: FrameRequestCallback = () => {};
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { tick = callback; return 1; });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

  let playback!: ReturnType<typeof usePrevisPlayback>;
  function Playback() {
    playback = usePrevisPlayback('/take.mp4', timeline);
    return <>
      <VideoPlayer ref={playback.attachPrevis} src='/previs.mp4' title='Previs' onDurationChange={playback.onPrevisDuration} onPlaybackRequest={playback.toggle} playing={playback.playing} onEnded={playback.onPrevisEnded} />
      <VideoPlayer ref={playback.attachGeneration} src='/take.mp4' title='Generation' onDurationChange={playback.onGenerationDuration} onPlaybackRequest={playback.toggle} playing={playback.playing} />
    </>;
  }
  render(<Playback />);
  const previs = screen.getByTitle('Previs') as HTMLVideoElement;
  const generation = screen.getByTitle('Generation') as HTMLVideoElement;
  for (const video of [previs, generation]) {
    Object.defineProperty(video, 'duration', { configurable: true, value: video === generation ? 8 : 12 });
    fireEvent.loadedMetadata(video);
  }
  async function flushMediaEvents() {
    // Bound delivery so a pause/play feedback loop fails instead of hanging the test.
    for (let delivered = 0; mediaEvents.length && delivered < 20; delivered++) {
      const deliver = mediaEvents.shift()!;
      await act(async () => { deliver(); });
    }
    expect(mediaEvents).toHaveLength(0);
  }
  const cue = {
    ...dialogue('first', 1, 4),
    audio: { assetId: 'a', assetFileId: 'f', offsetSeconds: 2, url: '/voice.wav' },
  };
  await act(async () => playback.playDialogue(cue));
  await flushMediaEvents();
  await act(async () => playback.playDialogue({ ...cue, ...dialogue('second', 5, 9) }));
  await flushMediaEvents();
  expect(playback.activeCue).toBe('second');
  expect(playback.playing).toBe(true);
  expect(previs.currentTime).toBe(5);
  expect(generation.currentTime).toBe(5);
  const recordings = vi.mocked(HTMLMediaElement.prototype.play).mock.contexts.filter((media) => media instanceof HTMLAudioElement);
  expect(recordings).toHaveLength(2);
  expect(recordings[0]!.paused).toBe(true);
  expect(recordings[1]!.paused).toBe(false);

  const controls = within(screen.getByTitle(title).closest('[data-controls]') as HTMLElement);
  fireEvent.click(controls.getByRole('button', { name: 'Pause shot' }));
  await flushMediaEvents();
  expect(playback.playing).toBe(false);
  expect(playback.activeCue).toBe('second');
  expect(previs.paused).toBe(true);
  expect(generation.paused).toBe(true);
  expect(recordings[1]!.paused).toBe(true);
  fireEvent.click(controls.getByRole('button', { name: 'Play shot' }));
  await flushMediaEvents();
  expect(playback.playing).toBe(true);
  expect(previs.paused).toBe(false);
  expect(generation.paused).toBe(false);

  act(() => { previs.currentTime = 8; generation.currentTime = 8; tick(1); });
  await flushMediaEvents();
  expect(playback.playing).toBe(true);
  expect(previs.paused).toBe(false);
  expect(generation.paused).toBe(true);

  fireEvent.click(controls.getByRole('button', { name: 'Pause shot' }));
  await flushMediaEvents();
  expect(playback.playing).toBe(false);
  expect(previs.paused).toBe(true);
  fireEvent.click(controls.getByRole('button', { name: 'Play shot' }));
  await flushMediaEvents();
  expect(playback.playing).toBe(true);
  expect(previs.paused).toBe(false);
  expect(generation.paused).toBe(true);

  // Stop before the newly queued play event arrives.
  act(() => playback.pause());
  act(() => playback.toggle());
  act(() => playback.pause());
  await flushMediaEvents();
  expect(playback.playing).toBe(false);
  expect(previs.paused).toBe(true);
  expect(generation.paused).toBe(true);
});

it.each(['pause', 'switch'])('ignores an interrupted play promise after a subsequent %s command', async (command) => {
  let rejectPlay!: (reason: Error) => void;
  const pendingPlay = new Promise<void>((_resolve, reject) => { rejectPlay = reject; });
  const player = {
    play: vi.fn(async () => {}).mockImplementationOnce(() => pendingPlay),
    pause: vi.fn(), seek: vi.fn(), setMuted: vi.fn(), getCurrentTime: () => 0,
  };
  const { result } = renderHook(() => usePrevisPlayback(undefined, timeline));
  act(() => { result.current.attachPrevis(player); result.current.onPrevisDuration(12); });
  await act(async () => result.current.playDialogue(dialogue('first', 1, 4)));
  await act(async () => {
    if (command === 'pause') result.current.pause();
    else result.current.playDialogue(dialogue('second', 5, 9));
  });
  await act(async () => rejectPlay(new DOMException('Playback interrupted by pause', 'AbortError')));
  expect(result.current.error).toBeNull();
  expect(result.current.playing).toBe(command === 'switch');
  expect(result.current.activeCue).toBe(command === 'switch' ? 'second' : 'first');
});

it('reports a failed current play attempt and stops the audition', async () => {
  const player = {
    play: vi.fn().mockRejectedValue(new DOMException('Playback denied', 'NotAllowedError')),
    pause: vi.fn(), seek: vi.fn(), setMuted: vi.fn(), getCurrentTime: () => 0,
  };
  const { result } = renderHook(() => usePrevisPlayback(undefined, timeline));
  act(() => { result.current.attachPrevis(player); result.current.onPrevisDuration(12); });
  await act(async () => result.current.playDialogue(dialogue('voice', 1, 4)));
  expect(result.current.error).toBe('Previs playback could not start. Try playing again.');
  expect(result.current.playing).toBe(false);
  expect(result.current.activeCue).toBe('voice');
  expect(player.pause).toHaveBeenCalled();
});

it('resumes a paused turn, stays silent after its recording ends, and cancels changed timing on refresh', async () => {
  let clock = 0;
  let tick: FrameRequestCallback = () => {};
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { tick = callback; return 1; });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  const recording = { currentTime: 0, muted: false, ended: false, pause: vi.fn(), play: vi.fn(async () => {}) };
  vi.stubGlobal('Audio', vi.fn(function () { return recording; }));
  const player = { play: vi.fn(async () => {}), pause: vi.fn(), seek: vi.fn((value: number) => { clock = value; }), setMuted: vi.fn(), getCurrentTime: () => clock };
  const cue = { ...dialogue('voice', 1, 4), audio: { assetId: 'a', assetFileId: 'f', url: '/voice.wav' } };
  const authored = { ...timeline, cues: [cue] };
  const { result, rerender } = renderHook(({ value }) => usePrevisPlayback(undefined, value), { initialProps: { value: authored } });
  act(() => { result.current.attachPrevis(player); result.current.onPrevisDuration(12); });
  await act(async () => result.current.playDialogue(cue));
  act(() => { clock = 2; tick(1); result.current.pause(); });
  await act(async () => result.current.playDialogue(cue));
  expect(clock).toBe(2);
  expect(player.seek).toHaveBeenCalledTimes(1);
  act(() => { recording.ended = true; clock = 3.2; tick(2); });
  expect(result.current.playing).toBe(true);
  expect(player.setMuted).toHaveBeenLastCalledWith(true);
  rerender({ value: { ...authored, cues: [{ ...cue }] } });
  expect(result.current.playing).toBe(true);
  rerender({ value: { ...authored, cues: [{ ...cue, endFrame: 120 }] } });
  expect(result.current.playing).toBe(false);
  expect(result.current.activeCue).toBeNull();
  expect(result.current.selection).toBeNull();
  expect(recording.pause).toHaveBeenCalled();
});
