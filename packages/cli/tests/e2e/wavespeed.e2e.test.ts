import fs from 'node:fs/promises';
import { afterAll, describe, expect, it } from 'vitest';
import { createWaveSpeedMediaProvider } from '@gorenku/studio-engines';
import { createProviderTestContext, isPaidProviderTestEnabled } from './provider-test-context.js';

const describeIf = isPaidProviderTestEnabled('RUN_WAVESPEED_TEST') ? describe : describe.skip;

describeIf('WaveSpeed paid provider smoke test', () => {
  let cleanup: (() => Promise<void>) | undefined;
  afterAll(async () => cleanup?.());

  it('validates against live metadata and generates one image', async () => {
    const test = await createProviderTestContext('wavespeed-ai');
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
    expect(result.artifacts).toHaveLength(1);
    const artifact = result.artifacts[0]!;
    expect(artifact.byteLength).toBeGreaterThan(0);
    expect((await fs.stat(artifact.path)).size).toBe(artifact.byteLength);
  });
});
