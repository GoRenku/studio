import { Hono } from 'hono';
import { expect, it, vi } from 'vitest';
import { createStructuredError } from '@gorenku/studio-diagnostics';
import { fakeProjectDataService } from '../testing/fake-project-data-service.js';
import { createShotPlanClipsRoute } from './shot-plan-clips.js';

it('delegates explicit selection and keeps the Core resource envelope', async () => {
  const report = { project: { projectName: 'movie' }, shotPlanId: 'plan', previsRevisionId: 'revision', clips: [], assets: [], unassignedAssets: [], sources: [], resourceKeys: ['surface:scene:scene:shot-plans'] };
  const selectShotPlanClipTake = vi.fn(async () => report);
  const app = new Hono().route('/:projectName', createShotPlanClipsRoute({
    projectData: { ...fakeProjectDataService(), selectShotPlanClipTake }, requireToken: async (_c, next) => { await next(); },
  }));
  const response = await app.request('/movie/screenplay/clips/clip/selection', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ takeId: 'take' }) });
  expect(selectShotPlanClipTake).toHaveBeenCalledWith({ projectName: 'movie', clipId: 'clip', takeId: 'take' });
  expect(await response.json()).toEqual(report);
  selectShotPlanClipTake.mockRejectedValueOnce(createStructuredError({ code: 'CORE_SHOT_PLAN_CLIP_SELECTION_INVALID', message: 'Choose a take of this clip.' }));
  const invalid = await app.request('/movie/screenplay/clips/clip/selection', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ takeId: 'wrong' }) });
  expect(await invalid.json()).toMatchObject({ error: { code: 'CORE_SHOT_PLAN_CLIP_SELECTION_INVALID' } });
});
