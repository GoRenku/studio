import path from 'node:path';
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

  it('uses live metadata and one local first frame to generate one four-second video', async () => {
    const test = await createProviderTestContext(credential!);
    cleanup = test.cleanup;
    const engine = createMediaEngine([createPikaMediaProvider()]);
    const request = {
      model: 'minimax/h3/image-to-video',
      input: {
        prompt: 'A slow forward camera glide while soft light moves across the scene.',
        first_frame_image: {
          $file: path.resolve('tests/e2e/fixtures/pika-first-frame.png'),
          mimeType: 'image/png',
          reviewLabel: 'Pika paid-test first frame',
        },
        duration: 4,
        resolution: '768P',
      },
    } as const;
    const reviewedRequest = structuredClone(request);

    const schema = await engine.readInputSchema('pika', request.model, test.context);
    expect(schema).toMatchObject({
      type: 'object',
      required: expect.arrayContaining(['prompt', 'first_frame_image']),
    });
    await engine.validate('pika', request, test.context);
    const result = await engine.execute('pika', request, test.context);

    expect(request).toEqual(reviewedRequest);
    expect(result).toMatchObject({
      provider: 'pika',
      model: request.model,
      requestId: expect.any(String),
      artifacts: [{
        mimeType: 'video/mp4',
        byteLength: expect.any(Number),
      }],
      receipt: {
        requestId: expect.any(String),
        status: 'completed',
        mediaType: 'video',
      },
    });
    expect(result.artifacts[0]!.byteLength).toBeGreaterThan(0);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(credential!);
    expect(serialized).not.toContain('X-Amz-Signature');
    expect(serialized).not.toContain('cdn.pika.art');
    expect(serialized).not.toContain('https://');
  });
});
