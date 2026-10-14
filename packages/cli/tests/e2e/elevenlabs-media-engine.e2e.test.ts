import { afterAll, describe, expect, it } from 'vitest';
import { createElevenLabsMediaProvider, createMediaEngine } from '@gorenku/studio-engines';
import { createProviderTestContext, isPaidProviderTestEnabled } from './provider-test-context.js';

const voice = process.env.ELEVENLABS_TEST_TTS_VOICE_ID ?? 'EXAVITQu4vr4xnSDxMaL';
const describeIf = isPaidProviderTestEnabled('RUN_ELEVENLABS_MEDIA_ENGINE_TEST') ? describe : describe.skip;

describeIf('ElevenLabs MediaEngine paid smoke test', () => {
  let cleanup: (() => Promise<void>) | undefined;
  afterAll(async () => cleanup?.());

  it('validates and generates short TTS audio through MediaEngine dispatch', async () => {
    const test = await createProviderTestContext('elevenlabs');
    cleanup = test.cleanup;
    const engine = createMediaEngine([createElevenLabsMediaProvider()]);
    const request = {
      model: 'eleven_v3',
      input: {
        text: 'Renku Studio MediaEngine smoke test.',
        voice,
        output_format: 'mp3_44100_128',
      },
    } as const;
    await engine.validate('elevenlabs', request, test.context);
    const result = await engine.execute('elevenlabs', request, test.context);
    expect(result).toMatchObject({
      provider: 'elevenlabs',
      model: 'eleven_v3',
      artifacts: [{ mimeType: 'audio/mpeg', byteLength: expect.any(Number) }],
    });
  });
});
