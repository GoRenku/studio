import { expect, it } from 'vitest';
import { clipPlaybackSequence, locateClip, clipTakeLabel } from './clip-playback-sequence';
import { rawClipFixture } from './clip-playback-fixtures';

it('maps actual unequal durations, chooses incoming boundaries and holds the known endpoint', () => {
  const report = rawClipFixture([3, 7, 2]);
  const sequence = clipPlaybackSequence(report, {});
  expect(sequence.map((segment) => segment.start)).toEqual([0, 3, 10]);
  expect(locateClip(sequence, 3)?.clip.number).toBe(2);
  expect(locateClip(sequence, 12)?.clip.number).toBe(3);
  expect(clipTakeLabel(report.clips[0]!, report.clips[0]!.takes[0]!)).toBe('Clip 1.1: Initial');
  expect(clipTakeLabel(report.clips[1]!, report.clips[1]!.takes[0]!)).toBe('Clip 2.1');
});

it('does not silently cross pending, failed or unknown-duration media', () => {
  const report = rawClipFixture([3, 7, 2]);
  report.clips[1]!.selectedTakeId = null;
  let sequence = clipPlaybackSequence(report, {});
  expect(sequence[2]!.blocked).toBe(true);
  expect(locateClip(sequence, 4)?.clip.number).toBe(1);
  report.clips[1]!.selectedTakeId = 'take-1';
  sequence = clipPlaybackSequence(report, { '/clip-1.mp4': null });
  expect(sequence[1]!.duration).toBeNull();
  expect(sequence[2]!.blocked).toBe(true);
  expect(locateClip(sequence, 4)?.clip.number).toBe(1);
});
