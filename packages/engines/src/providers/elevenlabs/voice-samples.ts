import { Buffer } from 'node:buffer';
import type { EngineLogger } from '../../media/contracts.js';
import { EngineError } from '../../shared/errors.js';

const ACCEPTED_API_BASE_URLS = new Set([
  'https://api.elevenlabs.io',
  'https://api.us.elevenlabs.io',
  'https://api.eu.residency.elevenlabs.io',
  'https://api.in.residency.elevenlabs.io',
]);

export interface ElevenLabsVoiceSampleAudioRequest {
  voiceId: string;
  credential: string;
  apiBaseUrl?: string;
  logger?: EngineLogger;
  signal?: AbortSignal;
  fetch?: typeof fetch;
}

export interface ElevenLabsVoiceSampleAudio {
  provider: 'elevenlabs';
  voiceId: string;
  sampleId: string;
  voiceName: string | null;
  sampleFileName: string | null;
  mimeType: 'audio/mpeg';
  audioBytes: Buffer;
  fetchedAt: string;
  apiBaseUrl: string;
  contentLength: number;
}

export async function fetchElevenLabsVoiceSampleAudio(
  input: ElevenLabsVoiceSampleAudioRequest,
): Promise<ElevenLabsVoiceSampleAudio> {
  const voiceId = input.voiceId.trim();
  if (!voiceId) {
    throw requestError('ElevenLabs voiceId is required.');
  }
  if (!input.credential.trim()) {
    throw new EngineError('ENGINE_AUTHENTICATION_FAILED', 'ElevenLabs credential is required.', {
      provider: 'elevenlabs', model: 'voice-sample-audio',
    });
  }
  const apiBaseUrl = input.apiBaseUrl ?? 'https://api.elevenlabs.io';
  if (!ACCEPTED_API_BASE_URLS.has(apiBaseUrl)) {
    throw requestError(`Unsupported ElevenLabs API base URL: ${apiBaseUrl}.`);
  }
  const request = input.fetch ?? fetch;
  const metadataResponse = await request(
    `${apiBaseUrl}/v1/voices/${encodeURIComponent(voiceId)}`,
    { headers: { 'xi-api-key': input.credential }, signal: input.signal },
  );
  if (!metadataResponse.ok) {
    throw httpError(metadataResponse.status, 'voice metadata');
  }
  const metadata = await metadataResponse.json() as unknown;
  if (!isRecord(metadata)) {
    throw outputError('ElevenLabs voice metadata was malformed.');
  }
  const sample = readSample(metadata);
  const previewUrl = typeof metadata.preview_url === 'string'
    ? metadata.preview_url
    : sample?.url;
  if (!previewUrl) {
    throw outputError('ElevenLabs voice has no playable sample.');
  }
  const audioResponse = await request(previewUrl, { signal: input.signal });
  if (!audioResponse.ok) {
    throw httpError(audioResponse.status, 'voice sample');
  }
  const audioBytes = Buffer.from(await audioResponse.arrayBuffer());
  if (audioBytes.length === 0) {
    throw outputError('ElevenLabs voice sample was empty.');
  }
  return {
    provider: 'elevenlabs',
    voiceId,
    sampleId: sample?.id ?? `preview:${voiceId}`,
    voiceName: typeof metadata.name === 'string' ? metadata.name : null,
    sampleFileName: sample?.fileName ?? null,
    mimeType: 'audio/mpeg',
    audioBytes,
    fetchedAt: new Date().toISOString(),
    apiBaseUrl,
    contentLength: audioBytes.length,
  };
}

function readSample(metadata: Record<string, unknown>): {
  id: string;
  fileName: string | null;
  url?: string;
} | null {
  const candidate = Array.isArray(metadata.samples) ? metadata.samples[0] : undefined;
  if (!isRecord(candidate)) {
    return null;
  }
  const id = typeof candidate.sample_id === 'string' ? candidate.sample_id : undefined;
  if (!id) {
    return null;
  }
  return {
    id,
    fileName: typeof candidate.file_name === 'string' ? candidate.file_name : null,
    ...(typeof candidate.preview_url === 'string' ? { url: candidate.preview_url } : {}),
  };
}

function httpError(status: number, operation: string): EngineError {
  const code = status === 401 || status === 403
    ? 'ENGINE_AUTHENTICATION_FAILED'
    : status === 429 ? 'ENGINE_RATE_LIMITED' : 'ENGINE_REQUEST_REJECTED';
  return new EngineError(code, `ElevenLabs ${operation} request failed with HTTP ${status}.`, {
    provider: 'elevenlabs', model: 'voice-sample-audio', httpStatus: status,
    retryable: status === 429 || status >= 500,
  });
}

function requestError(message: string): EngineError {
  return new EngineError('ENGINE_REQUEST_INVALID', message, {
    provider: 'elevenlabs', model: 'voice-sample-audio',
  });
}

function outputError(message: string): EngineError {
  return new EngineError('ENGINE_OUTPUT_INVALID', message, {
    provider: 'elevenlabs', model: 'voice-sample-audio',
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
