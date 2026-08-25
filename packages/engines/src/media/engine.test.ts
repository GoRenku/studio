import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  createMediaEngine,
  createMemoryProviderMetadataCache,
  EngineError,
  findLocalMediaFiles,
  substituteLocalMediaFiles,
  type MediaProvider,
  type ProviderContext,
} from '../index.js';

describe('standalone MediaEngine provider seam', () => {
  it('delegates validation, execution, and recovery through one provider contract', async () => {
    const validate = vi.fn(async () => undefined);
    const execute = vi.fn(async (request) => ({ provider: 'atlas', model: request.model, requestId: 'job_1', artifacts: [] }));
    const recover = vi.fn(async (request) => ({ provider: 'atlas', model: request.model, requestId: request.requestId, artifacts: [] }));
    const provider: MediaProvider = { id: 'atlas', validate, execute, recover };
    const engine = createMediaEngine([provider]);
    const request = { model: 'atlas/image-v1', input: { prompt: 'stone arch' } };
    const context = providerContext();
    await engine.validate('atlas', request, context);
    await expect(engine.execute('atlas', request, { ...context, outputDirectory: '/tmp' })).resolves.toMatchObject({ requestId: 'job_1' });
    await expect(engine.recover('atlas', { ...request, requestId: 'job_1' }, { ...context, outputDirectory: '/tmp' })).resolves.toMatchObject({ requestId: 'job_1' });
    expect(validate).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledOnce();
    expect(recover).toHaveBeenCalledOnce();
  });

  it('rejects duplicate, unknown, and recovery-unsupported providers with closed errors', async () => {
    const provider = atlasProvider();
    expect(() => createMediaEngine([provider, provider])).toThrowError(expect.objectContaining({ code: 'ENGINE_REQUEST_INVALID' }));
    const engine = createMediaEngine([provider]);
    expect(() => engine.validate('missing', { model: 'model', input: {} }, providerContext())).toThrowError(expect.objectContaining({ code: 'ENGINE_PROVIDER_UNSUPPORTED' }));
    expect(() => engine.recover('atlas', { model: 'model', input: {}, requestId: 'job' }, { ...providerContext(), outputDirectory: '/tmp' })).toThrowError(expect.objectContaining({ code: 'ENGINE_RECOVERY_UNSUPPORTED' }));
  });

  it('discovers and substitutes exact LocalMediaFile markers recursively', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-engine-local-media-'));
    const filePath = path.join(directory, 'reference.png');
    await fs.writeFile(filePath, 'pixels');
    const input = { nested: [{ $file: filePath, mimeType: 'image/png' }], untouched: { $file: filePath, extra: true } };
    expect(findLocalMediaFiles(input)).toEqual([{ $file: filePath, mimeType: 'image/png' }]);
    await expect(substituteLocalMediaFiles(input, 'atlas', 'model', async (file) => {
      expect(Buffer.from(file.bytes).toString()).toBe('pixels');
      return 'https://provider.invalid/upload/reference';
    })).resolves.toEqual({
      nested: ['https://provider.invalid/upload/reference'],
      untouched: { $file: filePath, extra: true },
    });
  });

  it('preserves cancellation and structured provider failures', async () => {
    const controller = new AbortController();
    controller.abort('cancelled');
    const provider: MediaProvider = {
      id: 'atlas',
      async validate(_request, context) {
        if (context.signal.aborted) {
          throw new EngineError('ENGINE_CANCELLED', 'Cancelled.', { provider: 'atlas' });
        }
      },
      async execute() {
        throw new EngineError('ENGINE_JOB_FAILED', 'Provider rejected request.', { provider: 'atlas', retryable: false });
      },
    };
    const engine = createMediaEngine([provider]);
    await expect(engine.validate('atlas', { model: 'model', input: {} }, providerContext(controller.signal))).rejects.toMatchObject({ code: 'ENGINE_CANCELLED' });
    await expect(engine.execute('atlas', { model: 'model', input: {} }, { ...providerContext(), outputDirectory: '/tmp' })).rejects.toMatchObject({ code: 'ENGINE_JOB_FAILED', retryable: false });
  });
});

function atlasProvider(): MediaProvider {
  return { id: 'atlas', async validate() {}, async execute(request) { return { provider: 'atlas', model: request.model, artifacts: [] }; } };
}

function providerContext(signal = new AbortController().signal): ProviderContext {
  return {
    credential: 'secret',
    metadataCache: createMemoryProviderMetadataCache(),
    fetch: globalThis.fetch,
    signal,
    requestTimeoutMs: 1_000,
    operationTimeoutMs: 5_000,
  };
}
