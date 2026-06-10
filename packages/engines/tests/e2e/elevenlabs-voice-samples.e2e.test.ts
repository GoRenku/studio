/**
 * ElevenLabs provider voice sample retrieval e2e test.
 *
 * This calls read/import/sample endpoints only. It does not run paid generation.
 *
 * Run with:
 * RUN_ELEVENLABS_VOICE_SAMPLE_TEST=1 pnpm test:e2e -- elevenlabs-voice-samples
 *
 * Requires: ELEVENLABS_API_KEY env var.
 * Override the regression voice with ELEVENLABS_TEST_SHARED_VOICE_ID when needed.
 */

import { describe, expect, it } from 'vitest';
import { fetchElevenLabsVoiceSampleAudio } from '../../src/sdk/elevenlabs/voice-samples.js';
import { saveTestArtifact } from './test-utils.js';

const RUN_TEST = process.env.RUN_ELEVENLABS_VOICE_SAMPLE_TEST;
const API_KEY = process.env.ELEVENLABS_API_KEY;
const SHARED_VOICE_ID =
  process.env.ELEVENLABS_TEST_SHARED_VOICE_ID ?? 'YKrm0N1EAM9Bw27j8kuD';

const describeIf = RUN_TEST && API_KEY ? describe : describe.skip;

describeIf('ElevenLabs provider voice sample retrieval', () => {
  it('downloads a playable provider sample without generation', async () => {
    const audio = await fetchElevenLabsVoiceSampleAudio({
      voiceId: SHARED_VOICE_ID!,
    });

    expect(audio.provider).toBe('elevenlabs');
    expect(audio.voiceId).toBe(SHARED_VOICE_ID);
    expect(audio.sampleId).toEqual(expect.any(String));
    expect(audio.mimeType).toBe('audio/mpeg');
    expect(audio.contentLength).toBeGreaterThan(0);
    expect(audio.audioBytes.length).toBe(audio.contentLength);

    saveTestArtifact(
      `elevenlabs-provider-voice-sample-${audio.sampleId}.mp3`,
      audio.audioBytes
    );
  }, 60000);
});
