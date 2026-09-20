import { beforeEach, expect, it, vi } from 'vitest';
import { updateRenku } from '@gorenku/studio-core/server';
import { runUpdateCommand } from './update.js';

vi.mock('@gorenku/studio-core/server', () => ({ updateRenku: vi.fn() }));
const io = { stdout: { log: vi.fn() }, stderr: { error: vi.fn() } };
beforeEach(() => vi.clearAllMocks());

it('defaults to the full update and supports skills-only updates', async () => {
  expect(await runUpdateCommand([], false, io)).toBe(0);
  expect(updateRenku).toHaveBeenLastCalledWith('all');
  expect(await runUpdateCommand(['skills'], false, io)).toBe(0);
  expect(updateRenku).toHaveBeenLastCalledWith('skills');
});

it('rejects unknown subcommands and JSON mode without starting an update', async () => {
  for (const input of [['runtime'], ['skills', 'extra']]) {
    expect(await runUpdateCommand(input, false, io)).toBe(1);
  }
  expect(await runUpdateCommand([], true, io)).toBe(1);
  expect(updateRenku).not.toHaveBeenCalled();
});
