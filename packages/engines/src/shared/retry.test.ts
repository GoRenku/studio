import { describe, expect, it, vi } from 'vitest';
import type { ProviderContext } from '../media/contracts.js';
import { createMemoryProviderMetadataCache } from './metadata-cache.js';
import { withProviderRetries } from './retry.js';

describe('provider retry scheduling', () => {
  it('honors provider Retry-After classification and succeeds within the attempt bound', async () => {
    const operation = vi.fn().mockRejectedValueOnce(new Error('busy')).mockResolvedValue('ready');
    const sleep = vi.fn(async (_milliseconds: number, _signal: AbortSignal) => undefined);
    await expect(withProviderRetries({
      provider: 'atlas',
      model: 'image-v1',
      context: { credential: 'secret', metadataCache: createMemoryProviderMetadataCache(), fetch: globalThis.fetch, signal: new AbortController().signal, requestTimeoutMs: 1_000, operationTimeoutMs: 5_000, sleep },
      maxAttempts: 2,
      operation,
      classify: () => ({ retryable: true, retryAfterMs: 125 }),
    })).resolves.toBe('ready');
    expect(sleep).toHaveBeenCalledWith(125, expect.any(AbortSignal));
  });

  it('uses bounded jitter and stops after the configured attempt count', async () => {
    const operation = vi.fn(async () => { throw new Error('busy'); });
    const sleep = vi.fn(async (_milliseconds: number, _signal: AbortSignal) => undefined);
    await expect(withProviderRetries({
      provider: 'atlas',
      model: 'image-v1',
      context: context({ sleep, random: () => 0 }),
      maxAttempts: 3,
      operation,
      classify: () => ({ retryable: true }),
    })).rejects.toThrow('busy');
    expect(operation).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([750, 1_500]);
  });

  it('does not retry provider-classified request failures', async () => {
    const operation = vi.fn(async () => { throw new Error('invalid'); });
    await expect(withProviderRetries({
      provider: 'atlas',
      model: 'image-v1',
      context: context(),
      maxAttempts: 3,
      operation,
      classify: () => ({ retryable: false }),
    })).rejects.toThrow('invalid');
    expect(operation).toHaveBeenCalledOnce();
  });

  it('fails with cancellation before calling the provider', async () => {
    const controller = new AbortController();
    controller.abort('stop');
    const operation = vi.fn();
    await expect(withProviderRetries({
      provider: 'atlas',
      model: 'image-v1',
      context: context({ signal: controller.signal }),
      maxAttempts: 3,
      operation,
      classify: () => ({ retryable: true }),
    })).rejects.toMatchObject({ code: 'ENGINE_CANCELLED' });
    expect(operation).not.toHaveBeenCalled();
  });

  it('fails at the operation deadline instead of scheduling another delay', async () => {
    const sleep = vi.fn(async (_milliseconds: number, _signal: AbortSignal) => undefined);
    const clock = vi.fn()
      .mockReturnValueOnce(new Date('2026-08-24T00:00:00.000Z'))
      .mockReturnValue(new Date('2026-08-24T00:00:06.000Z'));
    await expect(withProviderRetries({
      provider: 'atlas',
      model: 'image-v1',
      context: context({ sleep, clock, operationTimeoutMs: 5_000 }),
      maxAttempts: 3,
      operation: async () => { throw new Error('busy'); },
      classify: () => ({ retryable: true }),
    })).rejects.toMatchObject({ code: 'ENGINE_OPERATION_TIMEOUT' });
    expect(sleep).not.toHaveBeenCalled();
  });
});

function context(overrides: Partial<ProviderContext> = {}): ProviderContext {
  return {
    credential: 'secret',
    metadataCache: createMemoryProviderMetadataCache(),
    fetch: globalThis.fetch,
    signal: new AbortController().signal,
    requestTimeoutMs: 1_000,
    operationTimeoutMs: 5_000,
    ...overrides,
  };
}
