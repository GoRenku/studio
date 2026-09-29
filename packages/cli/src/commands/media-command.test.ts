import { expect, it, vi } from 'vitest';
import { runMediaCommand } from './media-command.js';

const report = vi.hoisted(() => ({ valid: true, purpose: 'shot.image',
  asset: { id: 'asset_one', files: [{ projectRelativePath: 'media/shot.png' }],
    generationProvenance: { prompt: 'Exact recipe' } },
  generationProvenance: { prompt: 'Exact recipe' } }));
vi.mock('@gorenku/studio-core/server', () => ({ createProjectDataService: () => ({}) }));
vi.mock('./media-import/command.js', () => ({ mediaImportCommandHandler: {
  path: ['import'], run: async () => report,
} }));

it('selects compact completion by default and preserves the full JSON contract', async () => {
  const log = vi.fn();
  const options = { input: ['import'], flags: {}, io: { stdout: { log }, stderr: { error: vi.fn() } } };
  expect(await runMediaCommand({ ...options, json: false })).toBe(0);
  expect(log.mock.calls[0]![0]).toContain('media/shot.png');
  expect(log.mock.calls[0]![0]).not.toContain('Exact recipe');
  log.mockClear();
  expect(await runMediaCommand({ ...options, json: true })).toBe(0);
  expect(JSON.parse(log.mock.calls[0]![0])).toEqual(report);
});
