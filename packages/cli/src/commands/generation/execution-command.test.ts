import { expect, it, vi } from 'vitest';
import { runGenerationCommand } from './command.js';

const report = vi.hoisted(() => ({
  requestId: 'job_1', artifacts: [{ path: '/project/tmp/output.mp4', mimeType: 'video/mp4' }],
  provenance: { prompt: 'Exact recipe' }, provenancePath: '/project/tmp/provenance.json',
}));
vi.mock('@gorenku/studio-core/server', () => ({ createProjectDataService: () => ({}) }));
vi.mock('./execute.js', () => ({ executeGenerationRequest: async () => report }));
vi.mock('./recover.js', () => ({ recoverGenerationRequest: async () => report }));

it.each(['execute', 'recover'])('%s defaults to compact output and preserves full JSON', async (command) => {
  const log = vi.fn();
  const options = { input: [command], flags: {}, io: { stdout: { log }, stderr: { error: vi.fn() } } };
  await runGenerationCommand({ ...options, json: false });
  expect(log.mock.calls[0]![0]).toContain(report.provenancePath);
  expect(log.mock.calls[0]![0]).not.toContain('Exact recipe');
  log.mockClear();
  await runGenerationCommand({ ...options, json: true });
  expect(JSON.parse(log.mock.calls[0]![0])).toEqual(report);
});
