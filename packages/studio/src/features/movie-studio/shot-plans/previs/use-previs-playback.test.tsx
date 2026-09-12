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

it('auditions a bounded cue and applies independent mute', async () => {
  let tick: FrameRequestCallback = () => {};
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { tick = callback; return 1; });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  let clock = 0;
  const previs = { play: vi.fn(async () => {}), pause: vi.fn(), seek: vi.fn((time: number) => { clock = time; }), setMuted: vi.fn(), getCurrentTime: () => clock };
  const { result } = renderHook(() => usePrevisPlayback(timeline));
  act(() => {
    result.current.attachPrevis(previs);
    result.current.onPrevisDuration(10);
  });
  expect(result.current.time).toBe(0);
  expect(result.current.playing).toBe(false);
  act(() => result.current.seek(3));
  await act(async () => result.current.toggle());
  expect(previs.play).toHaveBeenCalled();
  expect(previs.setMuted).toHaveBeenLastCalledWith(false);
  act(() => { clock = 6; tick(1); });
  expect(result.current.playing).toBe(true);
  act(() => result.current.toggleMute());
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
  const { result } = renderHook(() => usePrevisPlayback(timeline));
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

it('keeps the new cue through queued media events and follows Previs controls', async () => {
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
    playback = usePrevisPlayback(timeline);
    return <>
      <VideoPlayer ref={playback.attachPrevis} src='/previs.mp4' title='Previs' onDurationChange={playback.onPrevisDuration} onPlaybackRequest={playback.toggle} playing={playback.playing} onEnded={playback.onPrevisEnded} />
    </>;
  }
  render(<Playback />);
  const previs = screen.getByTitle('Previs') as HTMLVideoElement;
  for (const video of [previs]) {
    Object.defineProperty(video, 'duration', { configurable: true, value: 12 });
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
  const recordings = vi.mocked(HTMLMediaElement.prototype.play).mock.contexts.filter((media) => media instanceof HTMLAudioElement);
  expect(recordings).toHaveLength(2);
  expect(recordings[0]!.paused).toBe(true);
  expect(recordings[1]!.paused).toBe(false);

  const controls = within(screen.getByTitle('Previs').closest('[data-controls]') as HTMLElement);
  fireEvent.click(controls.getByRole('button', { name: 'Pause shot' }));
  await flushMediaEvents();
  expect(playback.playing).toBe(false);
  expect(playback.activeCue).toBe('second');
  expect(previs.paused).toBe(true);
  expect(recordings[1]!.paused).toBe(true);
  fireEvent.click(controls.getByRole('button', { name: 'Play shot' }));
  await flushMediaEvents();
  expect(playback.playing).toBe(true);
  expect(previs.paused).toBe(false);

  act(() => { previs.currentTime = 8; tick(1); });
  await flushMediaEvents();
  expect(playback.playing).toBe(true);
  expect(previs.paused).toBe(false);

  fireEvent.click(controls.getByRole('button', { name: 'Pause shot' }));
  await flushMediaEvents();
  expect(playback.playing).toBe(false);
  expect(previs.paused).toBe(true);
  fireEvent.click(controls.getByRole('button', { name: 'Play shot' }));
  await flushMediaEvents();
  expect(playback.playing).toBe(true);
  expect(previs.paused).toBe(false);

  // Stop before the newly queued play event arrives.
  act(() => playback.pause());
  act(() => playback.toggle());
  act(() => playback.pause());
  await flushMediaEvents();
  expect(playback.playing).toBe(false);
  expect(previs.paused).toBe(true);
});

it.each(['pause', 'switch'])('ignores an interrupted play promise after a subsequent %s command', async (command) => {
  let rejectPlay!: (reason: Error) => void;
  const pendingPlay = new Promise<void>((_resolve, reject) => { rejectPlay = reject; });
  const player = {
    play: vi.fn(async () => {}).mockImplementationOnce(() => pendingPlay),
    pause: vi.fn(), seek: vi.fn(), setMuted: vi.fn(), getCurrentTime: () => 0,
  };
  const { result } = renderHook(() => usePrevisPlayback(timeline));
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
  const { result } = renderHook(() => usePrevisPlayback(timeline));
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
  const { result, rerender } = renderHook(({ value }) => usePrevisPlayback(value), { initialProps: { value: authored } });
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
