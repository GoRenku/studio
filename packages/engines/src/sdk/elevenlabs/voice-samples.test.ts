import { afterEach, describe, expect, it, vi } from 'vitest';
import { SdkErrorCode } from '../errors.js';
import { fetchElevenLabsVoiceSampleAudio } from './voice-samples.js';

describe('fetchElevenLabsVoiceSampleAudio', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('trims the voice id, selects the first usable sample, and returns audio provenance', async () => {
    const fetchOperation = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        voice_id: 'voice_123',
        name: 'Urban',
        samples: [
          { sample_id: '   ' },
          { sample_id: 'sample_123', file_name: 'preview.mp3' },
        ],
      }))
      .mockResolvedValueOnce(audioResponse(Buffer.from([1, 2, 3])));

    const audio = await fetchElevenLabsVoiceSampleAudio({
      voiceId: ' voice_123 ',
      fetch: fetchOperation,
      secretResolver: secretResolver(),
    });

    expect(audio).toMatchObject({
      provider: 'elevenlabs',
      voiceId: 'voice_123',
      sampleId: 'sample_123',
      voiceName: 'Urban',
      sampleFileName: 'preview.mp3',
      mimeType: 'audio/mpeg',
      apiBaseUrl: 'https://api.elevenlabs.io',
      contentLength: 3,
    });
    expect([...audio.audioBytes]).toEqual([1, 2, 3]);
  });

  it('downloads modern voice-library preview URLs without importing the voice', async () => {
    const voiceId = 'YKrm0N1EAM9Bw27j8kuD';
    const previewBytes = mp3Bytes();
    const fetchOperation = vi.fn()
      .mockResolvedValueOnce(providerErrorResponse(404, 'voice_not_found'))
      .mockResolvedValueOnce(voiceSearchResponse([
        {
          voice_id: voiceId,
          name: 'Tough Character',
          preview_url: 'https://storage.example.test/tough-character.mp3',
        },
      ]))
      .mockResolvedValueOnce(previewAudioResponse(previewBytes));

    const audio = await fetchElevenLabsVoiceSampleAudio({
      voiceId,
      fetch: fetchOperation,
      secretResolver: secretResolver(),
    });

    expectLastFetchCall(
      fetchOperation,
      'https://storage.example.test/tough-character.mp3',
      'GET'
    );
    expect(audio).toMatchObject({
      provider: 'elevenlabs',
      voiceId,
      sampleId: 'tough-character',
      voiceName: 'Tough Character',
      sampleFileName: 'tough-character.mp3',
      contentLength: previewBytes.length,
    });
    expect([...audio.audioBytes]).toEqual([...previewBytes]);
  });

  it('falls back to a voice preview URL when the SDK sample audio endpoint is unavailable', async () => {
    const previewBytes = mp3Bytes();
    const fetchOperation = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        voice_id: 'voice_123',
        name: 'Urban',
        samples: [{ sample_id: 'sample_123', file_name: 'sample.mp3' }],
        preview_url: 'https://storage.example.test/account-preview.mp3',
      }))
      .mockResolvedValueOnce(providerErrorResponse(400, 'sample_not_found'))
      .mockResolvedValueOnce(previewAudioResponse(previewBytes));

    const audio = await fetchElevenLabsVoiceSampleAudio({
      voiceId: 'voice_123',
      fetch: fetchOperation,
      secretResolver: secretResolver(),
    });

    expectLastFetchCall(
      fetchOperation,
      'https://storage.example.test/account-preview.mp3',
      'GET'
    );
    expect(audio).toMatchObject({
      provider: 'elevenlabs',
      voiceId: 'voice_123',
      sampleId: 'account-preview',
      sampleFileName: 'account-preview.mp3',
      contentLength: previewBytes.length,
    });
    expect([...audio.audioBytes]).toEqual([...previewBytes]);
  });

  it('fails fast when a missing voice is not available in shared voices', async () => {
    await expect(
      fetchElevenLabsVoiceSampleAudio({
        voiceId: 'missing_voice',
        fetch: vi.fn()
          .mockResolvedValueOnce(providerErrorResponse(404, 'voice_not_found'))
          .mockResolvedValueOnce(voiceSearchResponse([]))
          .mockResolvedValueOnce(libraryVoicesResponse([]))
          .mockResolvedValueOnce(libraryVoicesResponse([])),
        secretResolver: secretResolver(),
      })
    ).rejects.toMatchObject({ code: SdkErrorCode.INVALID_VOICE });
  });

  it('rejects invalid voice ids and unsupported API base URLs before network calls', async () => {
    const fetchOperation = vi.fn();
    await expect(
      fetchElevenLabsVoiceSampleAudio({
        voiceId: ' ',
        fetch: fetchOperation,
        secretResolver: secretResolver(),
      })
    ).rejects.toMatchObject({ code: SdkErrorCode.INVALID_VOICE });
    await expect(
      fetchElevenLabsVoiceSampleAudio({
        voiceId: 'voice_123',
        apiBaseUrl: 'https://example.com',
        fetch: fetchOperation,
        secretResolver: secretResolver(),
      })
    ).rejects.toMatchObject({ code: SdkErrorCode.PROVIDER_PREDICTION_FAILED });
    expect(fetchOperation).not.toHaveBeenCalled();
  });

  it('fails fast when voice metadata has no usable sample id', async () => {
    await expect(
      fetchElevenLabsVoiceSampleAudio({
        voiceId: 'voice_123',
        fetch: vi.fn().mockResolvedValueOnce(jsonResponse({
          voice_id: 'voice_123',
          samples: [{ sample_id: '' }],
        })),
        secretResolver: secretResolver(),
      })
    ).rejects.toMatchObject({ code: SdkErrorCode.INVALID_VOICE });
  });

  it('fails fast on empty audio and successful JSON audio responses', async () => {
    await expect(
      fetchElevenLabsVoiceSampleAudio({
        voiceId: 'voice_123',
        fetch: vi.fn()
          .mockResolvedValueOnce(jsonResponse(metadata()))
          .mockResolvedValueOnce(audioResponse(Buffer.alloc(0))),
        secretResolver: secretResolver(),
      })
    ).rejects.toMatchObject({ code: SdkErrorCode.PROVIDER_PREDICTION_FAILED });

    await expect(
      fetchElevenLabsVoiceSampleAudio({
        voiceId: 'voice_123',
        fetch: vi.fn()
          .mockResolvedValueOnce(jsonResponse(metadata()))
          .mockResolvedValueOnce(jsonResponse({ ok: true })),
        secretResolver: secretResolver(),
      })
    ).rejects.toMatchObject({ code: SdkErrorCode.PROVIDER_PREDICTION_FAILED });
  });

  it('maps provider error statuses to structured SDK error codes', async () => {
    await expectProviderStatus(401, 'invalid_api_key', SdkErrorCode.INVALID_API_KEY);
    await expectMissingVoiceStatus(404);
    await expectMissingVoiceStatus(422);
  });

  it('retries rate-limited audio requests and succeeds when a later attempt returns audio', async () => {
    const fetchOperation = vi.fn()
      .mockResolvedValueOnce(jsonResponse(metadata()))
      .mockResolvedValueOnce(providerErrorResponse(429, 'too_many_concurrent_requests'))
      .mockResolvedValueOnce(jsonResponse(metadata()))
      .mockResolvedValueOnce(audioResponse(Buffer.from([9])));

    const audio = await fetchElevenLabsVoiceSampleAudio({
      voiceId: 'voice_123',
      fetch: fetchOperation,
      secretResolver: secretResolver(),
    });

    expect(audio.contentLength).toBe(1);
    expect(fetchOperation).toHaveBeenCalledTimes(4);
  });

  async function expectProviderStatus(
    status: number,
    providerCode: string,
    sdkCode: string
  ) {
    await expect(
      fetchElevenLabsVoiceSampleAudio({
        voiceId: 'voice_123',
        fetch: vi.fn().mockResolvedValueOnce(providerErrorResponse(status, providerCode)),
        secretResolver: secretResolver(),
      })
    ).rejects.toMatchObject({ code: sdkCode });
  }

  async function expectMissingVoiceStatus(status: number) {
    await expect(
      fetchElevenLabsVoiceSampleAudio({
        voiceId: 'voice_123',
        fetch: vi.fn()
          .mockResolvedValueOnce(providerErrorResponse(status, 'voice_not_found'))
          .mockResolvedValueOnce(voiceSearchResponse([]))
          .mockResolvedValueOnce(libraryVoicesResponse([]))
          .mockResolvedValueOnce(libraryVoicesResponse([])),
        secretResolver: secretResolver(),
      })
    ).rejects.toMatchObject({ code: SdkErrorCode.INVALID_VOICE });
  }
});

function metadata(voiceId = 'voice_123') {
  return {
    voice_id: voiceId,
    samples: [{ sample_id: 'sample_123' }],
  };
}

function secretResolver() {
  return {
    async getSecret(key: string) {
      return key === 'ELEVENLABS_API_KEY' ? 'test-key' : null;
    },
  };
}

function jsonResponse(body: unknown, status = 200): globalThis.Response {
  return new globalThis.Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function voiceSearchResponse(voices: unknown[]): globalThis.Response {
  return jsonResponse({
    voices,
    has_more: false,
    total_count: voices.length,
  });
}

function libraryVoicesResponse(voices: unknown[]): globalThis.Response {
  return jsonResponse({
    voices: voices.map((voice) => ({
      date_unix: 1,
      accent: 'american',
      gender: 'male',
      age: 'middle_aged',
      descriptive: 'direct',
      use_case: 'characters_animation',
      category: 'generated',
      usage_character_count_1y: 0,
      usage_character_count_7d: 0,
      play_api_usage_character_count_1y: 0,
      cloned_by_count: 0,
      free_users_allowed: true,
      live_moderation_enabled: false,
      featured: false,
      ...(voice && typeof voice === 'object' ? voice : {}),
    })),
    has_more: false,
    total_count: voices.length,
  });
}

function audioResponse(body: Buffer): globalThis.Response {
  return new globalThis.Response(body, {
    status: 200,
    headers: { 'content-type': 'audio/mpeg' },
  });
}

function previewAudioResponse(body: Buffer): globalThis.Response {
  return new globalThis.Response(body, {
    status: 200,
    headers: { 'content-type': 'text/plain' },
  });
}

function providerErrorResponse(status: number, code: string): globalThis.Response {
  return jsonResponse({
    detail: {
      status: code,
      message: code,
    },
  }, status);
}

function mp3Bytes(): Buffer {
  return Buffer.from([0xff, 0xfb, 0x90, 0x64, 0x00]);
}

function expectLastFetchCall(
  fetchOperation: ReturnType<typeof vi.fn>,
  url: string,
  method: string
): void {
  expect(fetchOperation).toHaveBeenLastCalledWith(
    url,
    expect.objectContaining({ method })
  );
}
