import { describe, expect, it, vi } from 'vitest';
import { createRequestTimeoutFetch } from './request-timeout.js';

describe('provider request timeout', () => {
  it('maps an expired request deadline to a retryable structured error', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (_resource, init) => new Promise<Response>(
      (_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)),
    ));
    const request = createRequestTimeoutFetch({
      provider: 'atlas',
      model: 'image-v1',
      context: {
        fetch: fetchMock,
        signal: new AbortController().signal,
        requestTimeoutMs: 1,
      },
    });
    await expect(request('https://atlas.invalid')).rejects.toMatchObject({
      code: 'ENGINE_PROVIDER_UNAVAILABLE',
      retryable: true,
    });
  });

  it('preserves caller cancellation instead of reporting a timeout', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn<typeof fetch>(async (_resource, init) => new Promise<Response>(
      (_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)),
    ));
    const request = createRequestTimeoutFetch({
      provider: 'atlas',
      model: 'image-v1',
      context: { fetch: fetchMock, signal: controller.signal, requestTimeoutMs: 10_000 },
    });
    const pending = request('https://atlas.invalid');
    controller.abort('stop');
    await expect(pending).rejects.toMatchObject({ code: 'ENGINE_CANCELLED' });
  });
});
