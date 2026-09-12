// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useClipPlayback } from './use-clip-playback';
import { rawClipFixture } from './clip-playback-fixtures';

vi.mock('./use-clip-durations', () => ({ useClipDurations: () => ({}) }));
afterEach(() => cleanup());
const player = () => ({ play: vi.fn(async () => {}), pause: vi.fn(), seek: vi.fn(), setMuted: vi.fn(), getCurrentTime: () => 0 });

it('plays whole selected files in order and seeks to the local time of the incoming clip', async () => {
  const report = rawClipFixture([3, 7, 2]);
  const media = player();
  const { result } = renderHook(() => useClipPlayback(report));
  act(() => { result.current.attach(media); result.current.onDuration(); });
  await act(async () => result.current.play());
  expect(result.current.playing).toBe(true);
  act(() => result.current.onEnded());
  expect(result.current.file?.url).toBe('/clip-1.mp4');
  await act(async () => result.current.onDuration());
  expect(media.seek).toHaveBeenLastCalledWith(0);
  expect(media.play).toHaveBeenCalledTimes(2);
  act(() => result.current.seek(11));
  expect(result.current.file?.url).toBe('/clip-2.mp4');
  act(() => result.current.onDuration());
  expect(media.seek).toHaveBeenLastCalledWith(1);
  expect(result.current.playing).toBe(false);
  act(() => result.current.onEnded());
  expect(result.current.ended).toBe(true);
  expect(result.current.time).toBe(12);
});

it('auditions later clips across a gap without mutating selection and ignores an old playback failure', async () => {
  const report = rawClipFixture([3, 7, 2]);
  report.clips[1]!.selectedTakeId = null;
  let reject!: (error: Error) => void;
  const media = { ...player(), play: vi.fn(() => new Promise<void>((_, fail) => { reject = fail; })) };
  const { result } = renderHook(() => useClipPlayback(report));
  act(() => { result.current.attach(media); result.current.onDuration(); result.current.play(); });
  act(() => result.current.audition('take-2'));
  await act(async () => reject(new Error('old request')));
  expect(result.current.error).toBeNull();
  expect(result.current.file?.url).toBe('/clip-2.mp4');
  expect(result.current.duration).toBe(2);
  expect(report.clips[1]!.selectedTakeId).toBeNull();
  act(() => result.current.backToClips());
  expect(result.current.duration).toBe(3);
  act(() => result.current.onEnded());
  expect(result.current.time).toBe(3);
  expect(result.current.ended).toBe(true);
});
