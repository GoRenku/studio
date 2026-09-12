import { expect, it, vi } from 'vitest';
import { createProjectDataService } from '@gorenku/studio-core/server';
import { shotPlanClipCommandHandlers } from './shot-plan-clip-command-handlers.js';

it('parses exact numeric pairs without matching titles and delegates Core selection', async () => {
  const projectDataService = createProjectDataService();
  const take = { id: 'take', clipId: 'clip', number: 2, title: 'Initial', assetId: 'asset', assetFileId: 'file', sourceTakeId: null, createdAt: '' };
  const resolve = vi.spyOn(projectDataService, 'resolveShotPlanClipTake').mockResolvedValue(take);
  const runtime = { projectDataService, projectName: 'movie', homeDir: '/fixture', json: true, io: { stdout: { log: vi.fn() }, stderr: { error: vi.fn() } } };
  const handler = shotPlanClipCommandHandlers.find((entry) => entry.path.join(' ') === 'clip take resolve')!;
  expect(await handler.run({ runtime, flags: { shotPlan: 'plan', previsRevision: 'revision', number: '3.2' } })).toBe(take);
  expect(resolve).toHaveBeenCalledWith({ projectName: 'movie', homeDir: '/fixture', shotPlanId: 'plan', previsRevisionId: 'revision', clipNumber: 3, takeNumber: 2 });
  expect(() => handler.run({ runtime, flags: { number: 'Initial' } })).toThrow('Use a clip.take number');
});
