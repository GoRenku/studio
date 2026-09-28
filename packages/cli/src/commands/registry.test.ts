import { channel } from 'node:diagnostics_channel';
import { describe, expect, it } from 'vitest';
import { loadCommand } from './registry.js';

describe('deferred command loading', () => {
  it('classifies module failures separately from handler failures', async () => {
    await expect(loadCommand('test', async () => { throw new Error('missing module'); }))
      .rejects.toMatchObject({ code: 'CLI_COMMAND_LOAD_FAILED' });
    const handlerError = new Error('handler failure');
    const handler = await loadCommand('test', async () => async () => { throw handlerError; });
    await expect(handler()).rejects.toBe(handlerError);
  });

  it('publishes only scalar timing metadata on success and failure', async () => {
    const records: unknown[] = [];
    const subscriber = (record: unknown) => records.push(record);
    const performanceChannel = channel('renku.performance');
    performanceChannel.subscribe(subscriber);
    try {
      await loadCommand('sensitive-name', async () => 1);
      await expect(loadCommand('sensitive-name', async () => { throw new Error('private detail'); })).rejects.toBeDefined();
    } finally {
      performanceChannel.unsubscribe(subscriber);
    }
    expect(records).toEqual(['success', 'failure'].map((outcome) => ({
      package: 'cli', phase: 'command-load', durationMs: expect.any(Number), outcome,
    })));
    for (const record of records as Array<{ durationMs: number }>) {
      expect(record.durationMs).toBeGreaterThanOrEqual(0);
    }
  });
});
