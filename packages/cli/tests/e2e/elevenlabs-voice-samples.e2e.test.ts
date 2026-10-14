import { afterAll, describe, expect, it } from 'vitest';
import { fetchElevenLabsVoiceSampleAudio } from '@gorenku/studio-engines';
import { createProviderTestContext, isPaidProviderTestEnabled } from './provider-test-context.js';

const voiceId = process.env.ELEVENLABS_TEST_SHARED_VOICE_ID ?? 'YKrm0N1EAM9Bw27j8kuD';
const describeIf = isPaidProviderTestEnabled('RUN_ELEVENLABS_VOICE_SAMPLE_TEST') ? describe : describe.skip;

describeIf('ElevenLabs voice sample smoke test', () => {
  let cleanup: (() => Promise<void>) | undefined;
  afterAll(async () => cleanup?.());

  it('downloads a playable existing sample without generation', async () => {
    const test = await createProviderTestContext('elevenlabs');
    cleanup = test.cleanup;
    const result = await fetchElevenLabsVoiceSampleAudio({
      voiceId,
      credential: test.context.credential,
    });
    expect(result).toMatchObject({
      provider: 'elevenlabs',
      voiceId,
      mimeType: 'audio/mpeg',
      contentLength: expect.any(Number),
    });
    expect(result.audioBytes.byteLength).toBeGreaterThan(0);
  });
});
