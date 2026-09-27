import fs from 'node:fs/promises';
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
      model: 'black-forest-labs/flux-schnell',
      input: { prompt: 'A quiet landscape photograph of blue sky above a grassy field.' },
    }, test.context);
    expect(result).toMatchObject({
      provider: 'replicate',
      model: 'black-forest-labs/flux-schnell',
      artifacts: [{ mimeType: expect.stringMatching(/^image\//), byteLength: expect.any(Number) }],
    });
    expect(result.artifacts).toHaveLength(1);
    const artifact = result.artifacts[0]!;
    expect(artifact.byteLength).toBeGreaterThan(0);
    expect((await fs.stat(artifact.path)).size).toBe(artifact.byteLength);
  });
});
