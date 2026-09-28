import { expect, it, vi } from 'vitest';
import { createMemoryProviderMetadataCache } from '../../shared/metadata-cache.js';
import { createElevenLabsMediaProvider } from './index.js';

vi.mock('@elevenlabs/elevenlabs-js', () => {
  throw new Error('SDK unavailable');
});

it('loads without the SDK, validates locally, and translates deferred SDK failure before submission', async () => {
  const fetchMock = vi.fn<typeof fetch>();
  const context = {
    credential: 'test-credential',
    metadataCache: createMemoryProviderMetadataCache(),
    fetch: fetchMock,
    signal: new AbortController().signal,
    requestTimeoutMs: 1_000,
    operationTimeoutMs: 5_000,
    outputDirectory: '/unused-before-submission',
  };
  const provider = createElevenLabsMediaProvider();
  const request = { model: 'tts-model', input: { text: 'Test line', voice: 'voice-id' } };
  await expect(provider.validate(request, context)).resolves.toBeUndefined();
  await expect(provider.execute(request, context)).rejects.toMatchObject({
    code: 'ENGINE_PROVIDER_UNAVAILABLE',
  });
  expect(fetchMock).not.toHaveBeenCalled();
});
