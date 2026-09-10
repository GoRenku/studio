import { expect, it } from 'vitest';
import { validatePrevisPlayback, previsFrameToSeconds } from './timeline.js';

const timeline = () => ({
  frameRate: { numerator: 24000, denominator: 1001 }, frameCount: 240,
  subjects: [{ key: 'mara', label: 'Mara', color: '#Ee7744' }],
  segments: [{ id: 'wide', startFrame: 0, label: 'Wide' }, { id: 'close', startFrame: 72, label: 'Close' }],
  cues: [
    { id: 'line', kind: 'dialogue', speaker: 'mara', startFrame: 48, endFrame: 96, text: '**Exact line**' },
    { id: 'turn', kind: 'action', subject: 'mara', startFrame: 72, text: 'Turns' },
    { id: 'focus', kind: 'camera', startFrame: 72, text: 'Focus changes' },
    { id: 'door', kind: 'action', startFrame: 72, text: 'Door opens' },
    { id: 'overlap', kind: 'dialogue', speaker: 'mara', startFrame: 72, text: 'Another onset' },
  ],
});

it('preserves typed directions, simultaneous points and a dialogue crossing a cut', () => {
  const input = timeline();
  expect(validatePrevisPlayback(input)).toEqual({ playback: input, warnings: [] });
  expect(previsFrameToSeconds(72, input.frameRate)).toBe(3.003);
  expect(validatePrevisPlayback({ ...input, segments: input.segments.slice(0, 1) }).playback.segments).toHaveLength(1);
});

it.each([
  { frameRate: { numerator: 0, denominator: 1 } },
  { frameCount: 0 },
  { frameCount: Number.MAX_SAFE_INTEGER },
  { segments: [] },
  { segments: [{ id: 'a', startFrame: 1, label: 'Wide' }] },
  { segments: [{ id: 'a', startFrame: 0, label: 'A' }, { id: 'a', startFrame: 0, label: 'B' }] },
  { cues: [{ id: 'a', kind: 'action', startFrame: 240, text: '' }] },
  { cues: [{ id: 'a', kind: 'action', startFrame: 1.5, text: '' }] },
  { cues: [{ id: 'a', kind: 'camera', startFrame: 1, endFrame: 2, text: '' }] },
  { cues: [{ id: 'a', kind: 'action', startFrame: 1, audio: {}, text: '' }] },
  { cues: [{ id: 'a', kind: 'dialogue', startFrame: 1, endFrame: 1, speaker: 'mara', text: '' }] },
  { cues: [{ id: 'a', kind: 'dialogue', startFrame: 1, speaker: 'missing', text: '' }] },
])('rejects invalid timeline structure: %j', (change) => {
  expect(() => validatePrevisPlayback({ ...timeline(), ...change })).toThrowError(expect.objectContaining({ code: 'CORE_PREVIS_PLAYBACK_INVALID' }));
});

it('collects independent errors and localizes malformed optional audio', () => {
  try { validatePrevisPlayback({ ...timeline(), frameCount: 0, segments: [] }); }
  catch (error) { expect(error).toMatchObject({ issues: expect.arrayContaining([expect.objectContaining({ location: { path: ['playback', 'frameCount'] } }), expect.objectContaining({ location: { path: ['playback', 'segments'] } })]) }); }
  const input = timeline();
  const result = validatePrevisPlayback({ ...input, cues: [{ ...input.cues[0], audio: { assetId: 'a', assetFileId: 'f', offsetSeconds: -1 } }] });
  expect(result.playback.cues[0]).not.toHaveProperty('audio');
  expect(result.warnings).toMatchObject([{ code: 'CORE_PREVIS_AUDIO_UNAVAILABLE', location: { path: ['playback', 'cues', '0', 'audio'] } }]);
});
