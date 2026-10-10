import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderExecutionContext } from '../../../media/contracts.js';
import { createMemoryProviderMetadataCache } from '../../../shared/metadata-cache.js';

const elevenLabs = vi.hoisted(() => ({
  convertDialogue: vi.fn(),
}));

vi.mock('@elevenlabs/elevenlabs-js', () => ({
  ElevenLabsClient: class ElevenLabsClient {
    textToDialogue = { convert: elevenLabs.convertDialogue };
  },
}));

import { createElevenLabsMediaProvider } from '../index.js';

describe('ElevenLabs text to dialogue operation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps native dialogue input to the SDK request and writes one audio artifact', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-elevenlabs-dialogue-'));
    elevenLabs.convertDialogue
      .mockRejectedValueOnce({ statusCode: 503 })
      .mockResolvedValue(audioStream('dialogue'));
    const context = providerContext(directory);

    const result = await createElevenLabsMediaProvider().execute({
      model: 'eleven_v4/text-to-dialogue',
      input: {
        inputs: [
          { text: '[cold, quiet] Then the empire is suffocating.', voice: 'voice_a' },
          { text: '[whispering] Not yet.', voice: 'voice_b' },
        ],
        settings: { stability: 0.45, similarity: 0.75 },
        output_format: 'mp3_44100_128',
        language_code: 'en',
        seed: 12345,
      },
    }, context);

    expect(elevenLabs.convertDialogue).toHaveBeenCalledTimes(2);
    expect(elevenLabs.convertDialogue).toHaveBeenLastCalledWith({
      inputs: [
        { text: '[cold, quiet] Then the empire is suffocating.', voiceId: 'voice_a' },
        { text: '[whispering] Not yet.', voiceId: 'voice_b' },
      ],
      modelId: 'eleven_v4',
      settings: { stability: 0.45, similarity: 0.75 },
      outputFormat: 'mp3_44100_128',
      languageCode: 'en',
      seed: 12345,
    }, { abortSignal: context.signal });
    expect(result).toMatchObject({
      provider: 'elevenlabs',
      model: 'eleven_v4/text-to-dialogue',
      artifacts: [{ mimeType: 'audio/mpeg', byteLength: 8 }],
      receipt: { byteLength: 8, outputFormat: 'mp3_44100_128' },
    });
    expect(result.artifacts).toHaveLength(1);
    await expect(fs.readFile(result.artifacts[0].path, 'utf8')).resolves.toBe('dialogue');
  });

  it('omits optional settings that the request does not provide', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-elevenlabs-dialogue-'));
    elevenLabs.convertDialogue.mockResolvedValue(audioStream('wav'));
    const context = providerContext(directory);

    const result = await createElevenLabsMediaProvider().execute({
      model: 'eleven_v4/text-to-dialogue',
      input: {
        inputs: [{ text: 'Line', voice: 'voice_a' }],
        output_format: 'wav_44100',
      },
    }, context);

    expect(elevenLabs.convertDialogue).toHaveBeenCalledWith({
      inputs: [{ text: 'Line', voiceId: 'voice_a' }],
      modelId: 'eleven_v4',
      settings: undefined,
      outputFormat: 'wav_44100',
      languageCode: undefined,
      seed: undefined,
    }, { abortSignal: context.signal });
    expect(result.artifacts[0]).toMatchObject({ mimeType: 'audio/wav' });
    expect(result.artifacts[0].path.endsWith('.wav')).toBe(true);
  });

  it('collects every dialogue input issue before calling the provider', async () => {
    const voices = Array.from({ length: 11 }, (_, index) => `voice_${index}`);
    const error = await createElevenLabsMediaProvider().validate({
      model: 'eleven_v4/text-to-dialogue',
      input: {
        inputs: [
          { text: '', voice: voices[0] },
          { text: 'Missing voice' },
          ...voices.slice(1).map((voice) => ({ text: 'Line', voice })),
        ],
        settings: { stability: 'high', style: 0.2 },
        voice_settings: { stability: 0.4 },
        seed: -1,
      },
    }, providerContext('/unused')).catch((failure: unknown) => failure);

    expect(error).toMatchObject({
      code: 'ENGINE_REQUEST_INVALID',
      provider: 'elevenlabs',
      model: 'eleven_v4/text-to-dialogue',
    });
    const paths = ((error as { details: { instancePath: string; keyword: string }[] }).details)
      .map((issue) => `${issue.instancePath}:${issue.keyword}`);
    expect(paths).toEqual(expect.arrayContaining([
      '/voice_settings:additionalProperties',
      '/inputs/0/text:required',
      '/inputs/1/voice:required',
      '/inputs:maxDistinctVoices',
      '/settings/style:additionalProperties',
      '/settings/stability:type',
      '/seed:type',
    ]));
    expect(paths).toHaveLength(7);
    expect(elevenLabs.convertDialogue).not.toHaveBeenCalled();
  });

  it('requires a non-empty inputs array', async () => {
    await expect(createElevenLabsMediaProvider().validate({
      model: 'eleven_v4/text-to-dialogue',
      input: { inputs: [] },
    }, providerContext('/unused'))).rejects.toMatchObject({
      code: 'ENGINE_REQUEST_INVALID',
      details: [{ instancePath: '/inputs', keyword: 'minItems' }],
    });
  });

  it('allows ten distinct voices', async () => {
    await expect(createElevenLabsMediaProvider().validate({
      model: 'eleven_v4/text-to-dialogue',
      input: {
        inputs: Array.from({ length: 12 }, (_, index) => ({
          text: 'Line',
          voice: `voice_${index % 10}`,
        })),
      },
    }, providerContext('/unused'))).resolves.toBeUndefined();
  });

  it('rejects local-media markers in dialogue input', async () => {
    await expect(createElevenLabsMediaProvider().validate({
      model: 'eleven_v4/text-to-dialogue',
      input: { inputs: [{ text: 'Line', voice: { $file: 'voice.wav' } }] },
    }, providerContext('/unused'))).rejects.toMatchObject({
      code: 'ENGINE_LOCAL_MEDIA_INVALID',
    });
  });

  it('does not expose an input schema for the dialogue route', async () => {
    await expect(createElevenLabsMediaProvider().readInputSchema!(
      'eleven_v4/text-to-dialogue',
      providerContext('/unused'),
    )).rejects.toMatchObject({ code: 'ENGINE_INPUT_SCHEMA_UNAVAILABLE' });
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

function providerContext(outputDirectory: string): ProviderExecutionContext {
  return {
    credential: 'elevenlabs-secret',
    metadataCache: createMemoryProviderMetadataCache(),
    fetch: globalThis.fetch,
    signal: new AbortController().signal,
    requestTimeoutMs: 1_000,
    operationTimeoutMs: 10_000,
    outputDirectory,
    sleep: async () => undefined,
    random: () => 0,
  };
}
