import { mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import type {
  JsonValue,
  MediaProvider,
  ProviderContext,
  ProviderExecutionContext,
  ProviderRequest,
} from '../../media/contracts.js';
import { findLocalMediaFiles } from '../../media/local-files.js';
import { EngineError } from '../../shared/errors.js';
import { withProviderRetries } from '../../shared/retry.js';
import { createRequestTimeoutFetch } from '../../shared/request-timeout.js';
export {
  fetchElevenLabsVoiceSampleAudio,
  type ElevenLabsVoiceSampleAudio,
  type ElevenLabsVoiceSampleAudioRequest,
} from './voice-samples.js';

interface VoiceSettings {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  speed?: number;
  use_speaker_boost?: boolean;
}

export function createElevenLabsMediaProvider(): MediaProvider {
  return {
    id: 'elevenlabs',
    async validate(request, context) {
      requireCredential(request.model, context);
      if (findLocalMediaFiles(request.input).length > 0) {
        throw new EngineError(
          'ENGINE_LOCAL_MEDIA_INVALID',
          'ElevenLabs generation requests do not accept local-media markers.',
          { provider: 'elevenlabs', model: request.model },
        );
      }
      const input = asObject(request.input, request.model);
      if (request.model === 'music_v1') {
        requireString(input.prompt, 'prompt', request.model);
        return;
      }
      requireString(input.text, 'text', request.model);
      requireString(input.voice, 'voice', request.model);
    },
    async execute(request, context) {
      await this.validate(request, context);
      const input = asObject(request.input, request.model);
      const client = new ElevenLabsClient({
        apiKey: context.credential,
        fetch: createRequestTimeoutFetch({
          provider: 'elevenlabs',
          model: request.model,
          context,
        }),
        timeoutInSeconds: context.requestTimeoutMs / 1_000,
        maxRetries: 0,
      });
      let stream: ReadableStream<Uint8Array>;
      try {
        stream = await withProviderRetries({
          provider: 'elevenlabs', model: request.model, context, maxAttempts: 3,
          classify: classifyRetry,
          operation: async () => request.model === 'music_v1'
            ? client.music.compose({
                prompt: input.prompt as string,
                musicLengthMs: numberValue(input.music_length_ms),
                modelId: 'music_v1',
                forceInstrumental: booleanValue(input.force_instrumental),
              }, { abortSignal: context.signal })
            : client.textToSpeech.convert(input.voice as string, {
                text: input.text as string,
                modelId: request.model,
                outputFormat: outputFormat(input),
                voiceSettings: voiceSettings(input.voice_settings),
              }, { abortSignal: context.signal }),
        }) as ReadableStream<Uint8Array>;
      } catch (error) {
        throw normalizeError(error, request.model);
      }
      const bytes = await collectStream(stream, request.model);
      const { mimeType, extension } = outputDescription(input);
      const artifact = await writeAudio(bytes, mimeType, extension, request, context);
      return {
        provider: 'elevenlabs',
        model: request.model,
        artifacts: [artifact],
        receipt: { byteLength: bytes.byteLength, outputFormat: outputFormat(input) },
      };
    },
  };
}

async function collectStream(
  stream: ReadableStream<Uint8Array>,
  model: string,
): Promise<Uint8Array> {
  try {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    for (;;) {
      const next = await reader.read();
      if (next.done) {
        break;
      }
      chunks.push(next.value);
    }
    const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    if (bytes.byteLength === 0) {
      throw new Error('Audio stream was empty.');
    }
    return bytes;
  } catch (error) {
    throw new EngineError('ENGINE_OUTPUT_INVALID', 'ElevenLabs returned invalid audio.', {
      provider: 'elevenlabs', model, cause: error,
    });
  }
}

async function writeAudio(
  bytes: Uint8Array,
  mimeType: string,
  extension: string,
  request: ProviderRequest,
  context: ProviderExecutionContext,
) {
  await mkdir(context.outputDirectory, { recursive: true });
  const destination = join(context.outputDirectory, `output-01.${extension}`);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, bytes, { flag: 'wx' });
    await rename(temporary, destination);
    return {
      path: destination,
      mimeType,
      byteLength: (await stat(destination)).size,
    };
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw new EngineError('ENGINE_DOWNLOAD_FAILED', 'ElevenLabs audio could not be saved.', {
      provider: 'elevenlabs', model: request.model, cause: error,
    });
  }
}

function asObject(value: JsonValue, model: string): Record<string, JsonValue> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new EngineError('ENGINE_REQUEST_INVALID', 'ElevenLabs input must be an object.', {
      provider: 'elevenlabs', model,
    });
  }
  return value;
}

function requireString(value: JsonValue | undefined, field: string, model: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new EngineError('ENGINE_REQUEST_INVALID', `ElevenLabs "${field}" is required.`, {
      provider: 'elevenlabs', model,
    });
  }
}

function requireCredential(model: string, context: ProviderContext): void {
  if (!context.credential) {
    throw new EngineError('ENGINE_AUTHENTICATION_FAILED', 'ElevenLabs credential is required.', {
      provider: 'elevenlabs', model,
    });
  }
}

function outputFormat(input: Record<string, JsonValue>) {
  return (typeof input.output_format === 'string'
    ? input.output_format
    : 'mp3_44100_128') as 'mp3_44100_128';
}

function outputDescription(input: Record<string, JsonValue>): {
  mimeType: string;
  extension: string;
} {
  const format = outputFormat(input);
  if (format.startsWith('pcm_') || format.startsWith('wav_')) {
    return { mimeType: 'audio/wav', extension: 'wav' };
  }
  if (format.startsWith('opus_')) {
    return { mimeType: 'audio/ogg', extension: 'ogg' };
  }
  return { mimeType: 'audio/mpeg', extension: 'mp3' };
}

function voiceSettings(value: JsonValue | undefined) {
  if (value === undefined || value === null || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const settings = value as VoiceSettings;
  return {
    stability: settings.stability,
    similarityBoost: settings.similarity_boost,
    style: settings.style,
    speed: settings.speed,
    useSpeakerBoost: settings.use_speaker_boost,
  };
}

function numberValue(value: JsonValue | undefined): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function booleanValue(value: JsonValue | undefined): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function classifyRetry(error: unknown): { retryable: boolean; retryAfterMs?: number } {
  const status = readStatus(error);
  return {
    retryable: status === 429 || (status !== undefined && status >= 500),
    ...(readRetryAfter(error) === undefined ? {} : { retryAfterMs: readRetryAfter(error) }),
  };
}

function normalizeError(error: unknown, model: string): EngineError {
  const status = readStatus(error);
  const code = status === 401 || status === 403
    ? 'ENGINE_AUTHENTICATION_FAILED'
    : status === 429
      ? 'ENGINE_RATE_LIMITED'
      : status !== undefined && status >= 400 && status < 500
        ? 'ENGINE_REQUEST_REJECTED'
        : 'ENGINE_PROVIDER_UNAVAILABLE';
  return new EngineError(code, error instanceof Error ? error.message : 'ElevenLabs request failed.', {
    provider: 'elevenlabs', model, httpStatus: status,
    retryable: status === 429 || (status !== undefined && status >= 500), cause: error,
  });
}

function readStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }
  for (const key of ['status', 'statusCode']) {
    const value = key in error ? error[key as keyof typeof error] : undefined;
    if (typeof value === 'number') {
      return value;
    }
  }
  return undefined;
}

function readRetryAfter(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('headers' in error)) {
    return undefined;
  }
  const headers = error.headers;
  if (!(headers instanceof Headers)) {
    return undefined;
  }
  const value = Number(headers.get('retry-after'));
  return Number.isFinite(value) ? value * 1_000 : undefined;
}
