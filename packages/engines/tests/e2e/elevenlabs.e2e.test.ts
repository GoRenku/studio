import { afterAll, describe, expect, it } from 'vitest';
import { createElevenLabsMediaProvider } from '../../src/providers/elevenlabs/index.js';
import { readOptInProviderTestCredential } from './provider-test-credentials.js';
import { createProviderTestContext } from './provider-test-context.js';

const credential = readOptInProviderTestCredential({
  optInEnvironmentVariable: 'RUN_ELEVENLABS_TEST',
  credentialEnvironmentVariable: 'ELEVENLABS_API_KEY',
});
const voice = process.env.ELEVENLABS_TEST_TTS_VOICE_ID ?? 'EXAVITQu4vr4xnSDxMaL';
const describeIf = credential ? describe : describe.skip;

describeIf('ElevenLabs paid provider smoke test', () => {
  const cleanups: Array<() => Promise<void>> = [];
  afterAll(async () => Promise.all(cleanups.map((cleanup) => cleanup())));

  it('generates a short TTS artifact through the standalone provider', async () => {
    const test = await createProviderTestContext(credential!);
    cleanups.push(test.cleanup);
    const result = await createElevenLabsMediaProvider().execute({
      model: 'eleven_v3',
      input: {
        text: 'Renku Studio provider smoke test.',
        voice,
        output_format: 'mp3_44100_128',
      },
    }, test.context);
    expect(result).toMatchObject({
      provider: 'elevenlabs',
      model: 'eleven_v3',
      artifacts: [{ mimeType: 'audio/mpeg', byteLength: expect.any(Number) }],
    });
  });

  it('generates a bounded music artifact through the standalone provider', async () => {
    const test = await createProviderTestContext(credential!);
    cleanups.push(test.cleanup);
    const result = await createElevenLabsMediaProvider().execute({
      model: 'music_v1',
      input: {
        prompt: 'A sparse instrumental piano cadence.',
        music_length_ms: 10_000,
        force_instrumental: true,
      },
    }, test.context);
    expect(result).toMatchObject({
      provider: 'elevenlabs',
      model: 'music_v1',
      artifacts: [{ mimeType: 'audio/mpeg', byteLength: expect.any(Number) }],
    });
  });
});
