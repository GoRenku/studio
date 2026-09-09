import { expect, it } from 'vitest';
import { toStudioPrevisResponse } from './previs-responses.js';

it('exposes exact audio identifiers through the Asset endpoint without retained source paths', () => {
  const response = toStudioPrevisResponse('a movie', {
    project: { projectName: 'a movie', projectFolder: '/private/project' }, shotPlanId: 'plan', sourceDirectory: 'previs/source', resourceKeys: [],
    revisions: [{ id: 'revision', number: 1, createdAt: '', sourceDirectory: 'private/revisions/1', render: null, generations: [], description: '# Exact\n', warnings: [],
      playback: { subjects: [], cues: [{ startSeconds: 0, text: 'Voice', audio: { assetId: 'asset/one', assetFileId: 'file two', offsetSeconds: 3 } }] } }],
  });
  expect(JSON.stringify(response)).not.toContain('private');
  expect(JSON.stringify(response)).not.toContain('sourceDirectory');
  expect(response.revisions[0]?.playback?.cues[0]?.audio?.url).toBe('/studio-api/projects/a%20movie/assets/asset%2Fone/files/file%20two');
  expect(response.revisions[0]?.description).toBe('# Exact\n');
});
