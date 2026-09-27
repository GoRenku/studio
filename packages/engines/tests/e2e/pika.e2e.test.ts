import fs from 'node:fs/promises';
import { afterAll, describe, expect, it } from 'vitest';
import {
  createMediaEngine,
  createPikaMediaProvider,
} from '../../src/index.js';
import { readOptInProviderTestCredential } from './provider-test-credentials.js';
import { createProviderTestContext } from './provider-test-context.js';

const credential = readOptInProviderTestCredential({
  optInEnvironmentVariable: 'RUN_PIKA_TEST',
  credentialEnvironmentVariable: 'PIKA_API_KEY',
});
const describeIf = credential ? describe : describe.skip;

describeIf('Pika paid provider smoke test', () => {
  let cleanup: (() => Promise<void>) | undefined;
  afterAll(async () => cleanup?.());

  it('uses live metadata to generate and download one inexpensive image', async () => {
    const test = await createProviderTestContext(credential!);
    cleanup = test.cleanup;
    const engine = createMediaEngine([createPikaMediaProvider()]);
    const request = {
      model: 'meta/muse-image-1.0/text-to-image',
      input: {
        prompt: 'A single small blue circle on a plain white background.',
        num_images: 1,
        reasoning_strength: 'low',
      },
    } as const;
    const reviewedRequest = structuredClone(request);

    const schema = await engine.readInputSchema('pika', request.model, test.context);
    expect(schema).toMatchObject({
      type: 'object',
      required: expect.arrayContaining(['prompt']),
    });
    await engine.validate('pika', request, test.context);
    const result = await engine.execute('pika', request, test.context);

    expect(request).toEqual(reviewedRequest);
    expect(result).toMatchObject({
      provider: 'pika',
      model: request.model,
      requestId: expect.any(String),
      artifacts: [{
        mimeType: expect.stringMatching(/^image\//),
        byteLength: expect.any(Number),
      }],
      receipt: {
        requestId: expect.any(String),
        status: 'completed',
        mediaType: 'image',
      },
    });
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0]!.byteLength).toBeGreaterThan(0);
    expect((await fs.stat(result.artifacts[0]!.path)).size).toBe(result.artifacts[0]!.byteLength);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(credential!);
    expect(serialized).not.toContain('X-Amz-Signature');
    expect(serialized).not.toContain('cdn.pika.art');
    expect(serialized).not.toContain('https://');
  });
});
