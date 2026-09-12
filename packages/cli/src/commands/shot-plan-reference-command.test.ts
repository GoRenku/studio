import { expect, it, vi } from 'vitest';
import { createProjectDataService } from '@gorenku/studio-core/server';
import { shotPlanReferenceCommandHandlers } from './shot-plan-reference-command.js';

it('delegates exact reference scope and preserves Core diagnostics', async () => {
  const projectDataService = createProjectDataService();
  const failure = Object.assign(new Error('Unsupported reference'), { code: 'CORE_SHOT_PLAN_REFERENCE_MEDIA_INVALID' });
  const importReference = vi.spyOn(projectDataService, 'importShotPlanReference').mockRejectedValue(failure);
  const runtime = { projectDataService, projectName: 'movie', homeDir: '/fixture', json: true, io: { stdout: { log: vi.fn() }, stderr: { error: vi.fn() } } };
  const handler = shotPlanReferenceCommandHandlers[0]!;
  await expect(handler.run({ runtime, flags: { shotPlan: 'plan', previsRevision: 'revision', source: 'tmp/voice.wav', mediaKind: 'audio', title: 'Voice', summary: 'Exact interval' } })).rejects.toBe(failure);
  expect(importReference).toHaveBeenCalledWith({ projectName: 'movie', homeDir: '/fixture', shotPlanId: 'plan', previsRevisionId: 'revision', sourceProjectRelativePath: 'tmp/voice.wav', mediaKind: 'audio', title: 'Voice', summary: 'Exact interval' });
  expect(() => handler.run({ runtime, flags: {} })).toThrow('--shot-plan');
});
