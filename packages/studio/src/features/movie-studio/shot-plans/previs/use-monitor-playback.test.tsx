// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useMonitorPlayback } from './use-monitor-playback';
import { rawClipFixture } from './clip-playback-fixtures';
import type { StudioPrevisRevision } from '@/services/shot-plan-previs/contracts';

vi.mock('./use-clip-durations', () => ({ useClipDurations: () => ({}) }));
afterEach(() => cleanup());
function player() {
  let time = 0;
  return { play: vi.fn(async () => {}), pause: vi.fn(), seek: vi.fn((value: number) => { time = value; }), setMuted: vi.fn(), getCurrentTime: () => time };
}
const revision: StudioPrevisRevision = {
  id: 'revision', number: 1, createdAt: '', description: null, render: null, warnings: [], clips: rawClipFixture([3, 5]),
  playback: { frameRate: { numerator: 24, denominator: 1 }, frameCount: 288, cues: [], segments: [], subjects: [] },
};

it('starts independent, links to the last manipulated elapsed time and preserves positions when unlinked', async () => {
  const left = player(); const right = player();
  const { result } = renderHook(() => useMonitorPlayback(revision));
  act(() => { result.current.previs.attachPrevis(left); result.current.previs.onPrevisDuration(12); result.current.generation.attach(right); result.current.generation.onDuration(); });
  act(() => result.current.seek('generation', 2));
  expect(result.current.previs.time).toBe(0);
  act(() => result.current.toggleLink());
  expect(result.current.previs.time).toBe(2);
  expect(result.current.generation.time).toBe(2);
  await act(async () => result.current.toggle('previs'));
  expect(left.play).toHaveBeenCalled(); expect(right.play).toHaveBeenCalled();
  expect(left.setMuted).toHaveBeenLastCalledWith(true);
  expect(right.setMuted).toHaveBeenLastCalledWith(false);
  act(() => result.current.toggleMute('previs'));
  expect(left.setMuted).toHaveBeenLastCalledWith(false);
  expect(right.setMuted).toHaveBeenLastCalledWith(true);
  act(() => result.current.seek('previs', 10));
  expect(result.current.generation.time).toBe(8);
  expect(result.current.previs.time).toBe(10);
  const previousStarts = right.play.mock.calls.length;
  await act(async () => result.current.toggle('generation'));
  expect(result.current.previs.time).toBe(10);
  expect(right.play).toHaveBeenCalledTimes(previousStarts);
  act(() => result.current.toggleLink());
  expect(result.current.previs.playing).toBe(true);
  expect(result.current.previs.time).toBe(10);
  expect(result.current.generation.time).toBe(8);
});

it('pauses Generation for a recorded cue and realigns on the next linked seek', async () => {
  const left = player(); const right = player();
  const { result } = renderHook(() => useMonitorPlayback(revision));
  act(() => { result.current.previs.attachPrevis(left); result.current.previs.onPrevisDuration(12); result.current.generation.attach(right); result.current.generation.onDuration(); });
  act(() => result.current.toggleLink());
  await act(async () => result.current.toggle('previs'));
  await act(async () => result.current.playDialogue({ id: 'voice', kind: 'dialogue', speaker: 'a', text: 'Hello', startFrame: 96, endFrame: 144 }));
  expect(result.current.linked).toBe(true);
  expect(result.current.generation.playing).toBe(false);
  expect(result.current.previs.time).toBe(4);
  act(() => result.current.seek('previs', 6));
  expect(result.current.generation.time).toBe(6);
  expect(result.current.previs.activeCue).toBeNull();
});
