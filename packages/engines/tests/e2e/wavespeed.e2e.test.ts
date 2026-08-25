import { afterAll, describe, expect, it } from 'vitest';
import { createWaveSpeedMediaProvider } from '../../src/providers/wavespeed/index.js';
import { readOptInProviderTestCredential } from './provider-test-credentials.js';
import { createProviderTestContext } from './provider-test-context.js';

const credential = readOptInProviderTestCredential({
  optInEnvironmentVariable: 'RUN_WAVESPEED_TEST',
  credentialEnvironmentVariable: 'WAVESPEED_API_KEY',
});
const describeIf = credential ? describe : describe.skip;

describeIf('WaveSpeed paid provider smoke test', () => {
  let cleanup: (() => Promise<void>) | undefined;
  afterAll(async () => cleanup?.());

  it('validates against live metadata and generates one image', async () => {
    const test = await createProviderTestContext(credential!);
    cleanup = test.cleanup;
    const result = await createWaveSpeedMediaProvider().execute({
      model: 'wavespeed-ai/z-image/turbo',
      input: { prompt: 'A single small blue circle on a plain white background.' },
    }, test.context);
    expect(result).toMatchObject({
      provider: 'wavespeed-ai',
      model: 'wavespeed-ai/z-image/turbo',
      artifacts: [{ mimeType: expect.stringMatching(/^image\//), byteLength: expect.any(Number) }],
    });
  });
});
