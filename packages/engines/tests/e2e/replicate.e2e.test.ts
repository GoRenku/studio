import { afterAll, describe, expect, it } from 'vitest';
import { createReplicateMediaProvider } from '../../src/providers/replicate/index.js';
import { readOptInProviderTestCredential } from './provider-test-credentials.js';
import { createProviderTestContext } from './provider-test-context.js';

const credential = readOptInProviderTestCredential({
  optInEnvironmentVariable: 'RUN_REPLICATE_TEST',
  credentialEnvironmentVariable: 'REPLICATE_API_TOKEN',
});
const describeIf = credential ? describe : describe.skip;

describeIf('Replicate paid provider smoke test', () => {
  let cleanup: (() => Promise<void>) | undefined;
  afterAll(async () => cleanup?.());

  it('validates against live metadata and generates one image', async () => {
    const test = await createProviderTestContext(credential!);
    cleanup = test.cleanup;
    const result = await createReplicateMediaProvider().execute({
      model: 'black-forest-labs/flux-kontext-pro',
      input: { prompt: 'A single small blue circle on a plain white background.' },
    }, test.context);
    expect(result).toMatchObject({
      provider: 'replicate',
      model: 'black-forest-labs/flux-kontext-pro',
      artifacts: [{ mimeType: expect.stringMatching(/^image\//), byteLength: expect.any(Number) }],
    });
  });
});
