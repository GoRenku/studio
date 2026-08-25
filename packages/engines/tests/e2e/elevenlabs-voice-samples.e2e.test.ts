import { describe, expect, it } from 'vitest';
import { fetchElevenLabsVoiceSampleAudio } from '../../src/providers/elevenlabs/index.js';
import { readOptInProviderTestCredential } from './provider-test-credentials.js';

const credential = readOptInProviderTestCredential({
  optInEnvironmentVariable: 'RUN_ELEVENLABS_VOICE_SAMPLE_TEST',
  credentialEnvironmentVariable: 'ELEVENLABS_API_KEY',
});
const voiceId = process.env.ELEVENLABS_TEST_SHARED_VOICE_ID ?? 'YKrm0N1EAM9Bw27j8kuD';
const describeIf = credential ? describe : describe.skip;

describeIf('ElevenLabs voice sample smoke test', () => {
  it('downloads a playable existing sample without generation', async () => {
    const result = await fetchElevenLabsVoiceSampleAudio({
      voiceId,
      credential: credential!,
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
