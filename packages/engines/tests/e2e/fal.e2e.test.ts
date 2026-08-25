import { afterAll, describe, expect, it } from 'vitest';
import { createFalMediaProvider } from '../../src/providers/fal-ai/index.js';
import { createMediaEngine } from '../../src/media/engine.js';
import { readOptInProviderTestCredential } from './provider-test-credentials.js';
import { createProviderTestContext } from './provider-test-context.js';

const credential = readOptInProviderTestCredential({
  optInEnvironmentVariable: 'RUN_FAL_TEST',
  credentialEnvironmentVariable: 'FAL_KEY',
});
const describeIf = credential ? describe : describe.skip;

describeIf('Fal.ai paid provider smoke test', () => {
  let cleanup: (() => Promise<void>) | undefined;
  afterAll(async () => cleanup?.());

  it('validates against live metadata and generates one small image', async () => {
    const test = await createProviderTestContext(credential!);
    cleanup = test.cleanup;
    const engine = createMediaEngine([createFalMediaProvider()]);
    const request = {
      model: 'openai/gpt-image-2',
      input: { prompt: 'A single small blue circle on a plain white background.', num_images: 1 },
    };
    await engine.validate('fal-ai', request, test.context);
    const result = await engine.execute('fal-ai', request, test.context);
    expect(result).toMatchObject({
      provider: 'fal-ai',
      model: 'openai/gpt-image-2',
      artifacts: [{ mimeType: expect.stringMatching(/^image\//), byteLength: expect.any(Number) }],
    });
  });
});
