import { describe, expect, it } from 'vitest';
import { createLatestOnlySaveQueue } from './latest-only-save-queue';

describe('createLatestOnlySaveQueue', () => {
  it('serializes saves and keeps only the newest pending value', async () => {
    const deferredSaves: Array<{
      value: string;
      resolve: (result: string) => void;
    }> = [];
    const successes: Array<{ value: string; result: string; latest: boolean }> = [];
    const queue = createLatestOnlySaveQueue<string, string>({
      save: (value) =>
        new Promise((resolve) => {
          deferredSaves.push({ value, resolve });
        }),
      onSaveSuccess: (success) => successes.push(success),
    });

    queue.requestSave('Draft A');
    await Promise.resolve();
    expect(deferredSaves.map((save) => save.value)).toEqual(['Draft A']);

    queue.requestSave('Draft B');
    queue.requestSave('Draft C');
    await Promise.resolve();
    expect(deferredSaves.map((save) => save.value)).toEqual(['Draft A']);

    deferredSaves[0]?.resolve('Saved A');
    await Promise.resolve();
    await Promise.resolve();

    expect(successes).toEqual([
      { value: 'Draft A', result: 'Saved A', latest: false },
    ]);
    expect(deferredSaves.map((save) => save.value)).toEqual([
      'Draft A',
      'Draft C',
    ]);

    deferredSaves[1]?.resolve('Saved C');
    await Promise.resolve();
    await Promise.resolve();

    expect(successes).toEqual([
      { value: 'Draft A', result: 'Saved A', latest: false },
      { value: 'Draft C', result: 'Saved C', latest: true },
    ]);
  });

  it('continues with the newest pending value after a failed save', async () => {
    const deferredSaves: Array<{
      value: string;
      resolve: (result: string) => void;
      reject: (error: Error) => void;
    }> = [];
    const failures: Array<{ value: string; latest: boolean }> = [];
    const successes: Array<{ value: string; latest: boolean }> = [];
    const queue = createLatestOnlySaveQueue<string, string>({
      save: (value) =>
        new Promise((resolve, reject) => {
          deferredSaves.push({ value, resolve, reject });
        }),
      onSaveFailure: (failure) =>
        failures.push({ value: failure.value, latest: failure.latest }),
      onSaveSuccess: (success) =>
        successes.push({ value: success.value, latest: success.latest }),
    });

    queue.requestSave('Draft A');
    await Promise.resolve();
    queue.requestSave('Draft B');

    deferredSaves[0]?.reject(new Error('Network failed'));
    await Promise.resolve();
    await Promise.resolve();

    expect(failures).toEqual([{ value: 'Draft A', latest: false }]);
    expect(deferredSaves.map((save) => save.value)).toEqual([
      'Draft A',
      'Draft B',
    ]);

    deferredSaves[1]?.resolve('Saved B');
    await Promise.resolve();
    await Promise.resolve();

    expect(successes).toEqual([{ value: 'Draft B', latest: true }]);
  });
});
