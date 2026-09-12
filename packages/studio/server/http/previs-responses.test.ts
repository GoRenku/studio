import { expect, it } from 'vitest';
import { toStudioPrevisResponse } from './previs-responses.js';

it('exposes exact audio identifiers through the Asset endpoint without retained source paths', () => {
  const response = toStudioPrevisResponse('a movie', {
    project: { projectName: 'a movie', projectFolder: '/private/project' }, shotPlanId: 'plan', sourceDirectory: 'previs/source', resourceKeys: [],
    revisions: [{ id: 'revision', number: 1, createdAt: '', sourceDirectory: 'private/revisions/1', render: null, clips: { project: { projectName: 'movie' }, shotPlanId: 'plan', previsRevisionId: 'revision', clips: [], assets: [], unassignedAssets: [], sources: [], resourceKeys: [] }, description: '# Exact\n', warnings: [],
      playback: { frameRate: { numerator: 24, denominator: 1 }, frameCount: 240, segments: [{ id: 'wide', label: 'Wide', startFrame: 0 }, { id: 'close', label: 'Close', startFrame: 48 }], subjects: [{ key: 'speaker', label: 'Speaker', color: '#112233' }], cues: [{ id: 'line', kind: 'dialogue', speaker: 'speaker', startFrame: 0, text: 'Voice', audio: { assetId: 'asset/one', assetFileId: 'file two', offsetSeconds: 3 } }, { id: 'step', kind: 'action', startFrame: 48, subject: 'speaker', text: 'Steps forward' }, { id: 'hold', kind: 'camera', startFrame: 48, text: 'Hold' }] } }],
  });
  expect(JSON.stringify(response)).not.toContain('private');
  expect(JSON.stringify(response)).not.toContain('sourceDirectory');
  expect(response.revisions[0]?.playback?.cues[0]).toMatchObject({ kind: 'dialogue', audio: { url: '/studio-api/projects/a%20movie/assets/asset%2Fone/files/file%20two' } });
  expect(response.revisions[0]?.playback?.cues.slice(1)).toEqual([{ id: 'step', kind: 'action', startFrame: 48, subject: 'speaker', text: 'Steps forward' }, { id: 'hold', kind: 'camera', startFrame: 48, text: 'Hold' }]);
  expect(response.revisions[0]?.playback?.segments[1]).toEqual({ id: 'close', label: 'Close', startFrame: 48 });
  expect(response.revisions[0]?.description).toBe('# Exact\n');
});
