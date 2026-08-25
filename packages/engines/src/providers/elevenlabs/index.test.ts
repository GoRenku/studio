import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderExecutionContext } from '../../media/contracts.js';
import { createMemoryProviderMetadataCache } from '../../shared/metadata-cache.js';

const elevenLabs = vi.hoisted(() => ({
  convert: vi.fn(),
  compose: vi.fn(),
}));

vi.mock('@elevenlabs/elevenlabs-js', () => ({
  ElevenLabsClient: class ElevenLabsClient {
    textToSpeech = { convert: elevenLabs.convert };
    music = { compose: elevenLabs.compose };
  },
}));

import { createElevenLabsMediaProvider } from './index.js';

describe('ElevenLabs media provider', () => {
  beforeEach(() => vi.clearAllMocks());

  it('validates native TTS input, retries system busy, and writes exact audio', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-elevenlabs-provider-'));
    elevenLabs.convert
      .mockRejectedValueOnce({ statusCode: 429, headers: new Headers({ 'retry-after': '1' }) })
      .mockResolvedValue(audioStream('voice'));
    const delays: number[] = [];
    const context = providerContext(directory, delays);

    const result = await createElevenLabsMediaProvider().execute({
      model: 'future_tts_model',
      input: {
        text: 'Welcome to the basilica.',
        voice: 'voice_1',
        output_format: 'mp3_44100_128',
        voice_settings: { stability: 0.4, similarity_boost: 0.8 },
      },
    }, context);

    expect(delays).toEqual([1_000]);
    expect(elevenLabs.convert).toHaveBeenCalledTimes(2);
    expect(elevenLabs.convert).toHaveBeenLastCalledWith('voice_1', {
      text: 'Welcome to the basilica.',
      modelId: 'future_tts_model',
      outputFormat: 'mp3_44100_128',
      voiceSettings: {
        stability: 0.4,
        similarityBoost: 0.8,
        style: undefined,
        speed: undefined,
        useSpeakerBoost: undefined,
      },
    }, { abortSignal: context.signal });
    expect(result).toMatchObject({
      provider: 'elevenlabs',
      model: 'future_tts_model',
      artifacts: [{ mimeType: 'audio/mpeg', byteLength: 5 }],
      receipt: { byteLength: 5, outputFormat: 'mp3_44100_128' },
    });
    await expect(fs.readFile(result.artifacts[0].path, 'utf8')).resolves.toBe('voice');
  });

  it('rejects local-media markers before constructing a provider request', async () => {
    await expect(createElevenLabsMediaProvider().validate({
      model: 'future_tts_model',
      input: { text: 'Line', voice: 'voice_1', audio: { $file: 'sample.wav' } },
    }, providerContext('/tmp', []))).rejects.toMatchObject({
      code: 'ENGINE_LOCAL_MEDIA_INVALID',
    });
  });
});

function audioStream(value: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(value));
      controller.close();
    },
  });
}

function providerContext(
  outputDirectory: string,
  delays: number[],
): ProviderExecutionContext {
  return {
    credential: 'elevenlabs-secret',
    metadataCache: createMemoryProviderMetadataCache(),
    fetch: globalThis.fetch,
    signal: new AbortController().signal,
    requestTimeoutMs: 1_000,
    operationTimeoutMs: 10_000,
    outputDirectory,
    sleep: async (milliseconds) => { delays.push(milliseconds); },
    random: () => 0,
  };
}
