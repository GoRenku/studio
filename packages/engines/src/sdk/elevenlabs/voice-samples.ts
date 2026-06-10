import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { loadProviderEnvFiles } from '../../provider-env-files.js';
import type { ProviderLogger, SecretResolver } from '../../types.js';
import { createProviderError, SdkErrorCode } from '../errors.js';
import { parseElevenlabsError, runWithRetries } from './retry.js';

const ELEVENLABS_API_KEY = 'ELEVENLABS_API_KEY';
const ELEVENLABS_API_BASE_URL = 'ELEVENLABS_API_BASE_URL';
const DEFAULT_API_BASE_URL = 'https://api.elevenlabs.io';
const SHARED_VOICE_PAGE_SIZE = 100;
const MAX_SHARED_VOICE_PAGES = 100;
const ACCEPTED_API_BASE_URLS = new Set([
  'https://api.elevenlabs.io',
  'https://api.us.elevenlabs.io',
  'https://api.eu.residency.elevenlabs.io',
  'https://api.in.residency.elevenlabs.io',
]);

export interface ElevenLabsVoiceSampleAudioRequest {
  voiceId: string;
  apiBaseUrl?: string;
  secretResolver?: SecretResolver;
  logger?: ProviderLogger;
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

type ElevenLabsSdkClient = InstanceType<typeof ElevenLabsClient>;

interface ElevenLabsVoiceMetadata {
  voiceId?: unknown;
  voice_id?: unknown;
  name?: unknown;
  samples?: unknown;
  previewUrl?: unknown;
  preview_url?: unknown;
  sharing?: unknown;
}

interface ElevenLabsVoiceSearchResponse {
  voices?: unknown;
}

interface ElevenLabsSharedVoicesResponse {
  voices?: unknown;
  hasMore?: unknown;
  has_more?: unknown;
}

interface ElevenLabsSharedVoiceMetadata {
  voiceId?: unknown;
  voice_id?: unknown;
  publicOwnerId?: unknown;
  public_owner_id?: unknown;
  name?: unknown;
  previewUrl?: unknown;
  preview_url?: unknown;
}

interface ElevenLabsVoiceSharingMetadata {
  publicOwnerId?: unknown;
  public_owner_id?: unknown;
}

interface ElevenLabsVoiceSampleMetadata {
  sampleId?: unknown;
  sample_id?: unknown;
  fileName?: unknown;
  file_name?: unknown;
}

interface ResolvedElevenLabsVoice {
  metadata: ElevenLabsVoiceMetadata;
  audioVoiceId: string;
  previewSample?: { sampleId: string; fileName: string | null; previewUrl: string };
}

interface LibraryVoice {
  publicOwnerId: string | null;
  voiceId: string;
  name: string;
  samples?: unknown;
  previewUrl: string | null;
}

export async function fetchElevenLabsVoiceSampleAudio(
  request: ElevenLabsVoiceSampleAudioRequest
): Promise<ElevenLabsVoiceSampleAudio> {
  const voiceId = requireVoiceId(request.voiceId);
  const apiBaseUrl = resolveApiBaseUrl(request.apiBaseUrl);
  const apiKey = await resolveApiKey(request.secretResolver);
  const fetchOperation = request.fetch ?? fetch;
  const client = createElevenLabsClient({ apiBaseUrl, apiKey, fetchOperation });

  return runWithRetries(
    async () => {
      const resolvedVoice = await resolveVoice({
        client,
        voiceId,
        signal: request.signal,
      });
      const { sample, audioBytes } = await fetchResolvedVoiceSampleAudio({
        client,
        fetchOperation,
        requestedVoiceId: voiceId,
        resolvedVoice,
        signal: request.signal,
      });
      return {
        provider: 'elevenlabs' as const,
        voiceId,
        sampleId: sample.sampleId,
        voiceName: typeof resolvedVoice.metadata.name === 'string'
          ? resolvedVoice.metadata.name
          : null,
        sampleFileName: sample.fileName,
        mimeType: 'audio/mpeg' as const,
        audioBytes,
        fetchedAt: new Date().toISOString(),
        apiBaseUrl,
        contentLength: audioBytes.length,
      };
    },
    {
      logger: request.logger,
      jobId: `elevenlabs-voice-sample:${voiceId}`,
      model: 'voice-sample-audio',
      plannerContext: {},
      maxAttempts: 3,
      defaultRetryMs: 100,
    }
  );
}

function createElevenLabsClient(input: {
  apiBaseUrl: string;
  apiKey: string;
  fetchOperation: typeof fetch;
}): ElevenLabsSdkClient {
  return new ElevenLabsClient({
    apiKey: input.apiKey,
    baseUrl: input.apiBaseUrl,
    fetch: input.fetchOperation,
    maxRetries: 0,
  });
}

async function resolveVoice(input: {
  client: ElevenLabsSdkClient;
  voiceId: string;
  signal?: AbortSignal;
}): Promise<ResolvedElevenLabsVoice> {
  try {
    return {
      metadata: await fetchVoiceMetadata(input),
      audioVoiceId: input.voiceId,
    };
  } catch (error) {
    if (!isVoiceNotFoundError(error)) {
      throw error;
    }
  }

  const libraryVoice = await fetchLibraryVoice(input);
  if (libraryVoice.previewUrl) {
    return {
      metadata: {
        voiceId: libraryVoice.voiceId,
        name: libraryVoice.name,
        samples: libraryVoice.samples,
        previewUrl: libraryVoice.previewUrl,
      },
      audioVoiceId: libraryVoice.voiceId,
      previewSample: previewSampleFromUrl(libraryVoice.previewUrl),
    };
  }

  if (!libraryVoice.publicOwnerId) {
    throw createProviderError(
      SdkErrorCode.INVALID_VOICE,
      `ElevenLabs library voice ${input.voiceId} did not include a preview URL or public owner id.`,
      { kind: 'user_input', causedByUser: true }
    );
  }

  const importedVoiceId = await addSharedVoice({
    client: input.client,
    sharedVoice: {
      publicOwnerId: libraryVoice.publicOwnerId,
      voiceId: libraryVoice.voiceId,
      name: libraryVoice.name,
    },
    signal: input.signal,
  });
  return {
    metadata: await fetchVoiceMetadata({
      ...input,
      voiceId: importedVoiceId,
    }),
    audioVoiceId: importedVoiceId,
  };
}

function requireVoiceId(input: string): string {
  const voiceId = input?.trim();
  if (!voiceId) {
    throw createProviderError(
      SdkErrorCode.INVALID_VOICE,
      'ElevenLabs voiceId is required to fetch a provider voice sample.',
      { kind: 'user_input', causedByUser: true }
    );
  }
  return voiceId;
}

function resolveApiBaseUrl(input: string | undefined): string {
  loadProviderEnvFiles();
  const apiBaseUrl = (input ?? process.env[ELEVENLABS_API_BASE_URL] ?? DEFAULT_API_BASE_URL).trim();
  if (!ACCEPTED_API_BASE_URLS.has(apiBaseUrl)) {
    throw createProviderError(
      SdkErrorCode.PROVIDER_PREDICTION_FAILED,
      `Unsupported ElevenLabs API base URL: ${apiBaseUrl}.`,
      {
        kind: 'user_input',
        causedByUser: true,
        metadata: { acceptedApiBaseUrls: [...ACCEPTED_API_BASE_URLS] },
      }
    );
  }
  return apiBaseUrl;
}

async function resolveApiKey(secretResolver: SecretResolver | undefined): Promise<string> {
  loadProviderEnvFiles();
  const apiKey = secretResolver
    ? await secretResolver.getSecret(ELEVENLABS_API_KEY)
    : process.env[ELEVENLABS_API_KEY] ?? null;
  if (!apiKey?.trim()) {
    throw createProviderError(
      SdkErrorCode.INVALID_API_KEY,
      'ELEVENLABS_API_KEY is required to fetch an ElevenLabs provider voice sample.',
      { kind: 'user_input', causedByUser: true }
    );
  }
  return apiKey.trim();
}

async function fetchVoiceMetadata(input: {
  client: ElevenLabsSdkClient;
  voiceId: string;
  signal?: AbortSignal;
}): Promise<ElevenLabsVoiceMetadata> {
  const metadata = await input.client.voices.get(
    input.voiceId,
    {},
    { abortSignal: input.signal }
  ) as ElevenLabsVoiceMetadata;
  const returnedVoiceId = voiceIdFromMetadata(metadata);
  if (returnedVoiceId && returnedVoiceId !== input.voiceId) {
    throw createProviderError(
      SdkErrorCode.INVALID_VOICE,
      `ElevenLabs returned voice metadata for ${returnedVoiceId}, expected ${input.voiceId}.`,
      { kind: 'user_input', causedByUser: true }
    );
  }
  return metadata;
}

async function fetchLibraryVoice(input: {
  client: ElevenLabsSdkClient;
  voiceId: string;
  signal?: AbortSignal;
}): Promise<LibraryVoice> {
  const modernVoice = await fetchModernLibraryVoice(input);
  if (modernVoice) {
    return modernVoice;
  }
  return await fetchSharedVoice(input);
}

async function fetchModernLibraryVoice(input: {
  client: ElevenLabsSdkClient;
  voiceId: string;
  signal?: AbortSignal;
}): Promise<LibraryVoice | null> {
  const body = await input.client.voices.search(
    {
      pageSize: 1,
      includeTotalCount: false,
      voiceIds: input.voiceId,
    },
    { abortSignal: input.signal }
  ) as ElevenLabsVoiceSearchResponse;
  if (!Array.isArray(body.voices)) {
    throw unexpectedProviderResponse(
      'ElevenLabs voice search response did not include a voices array.'
    );
  }

  for (const voice of body.voices) {
    const candidate = parseModernLibraryVoice(voice);
    if (candidate?.voiceId === input.voiceId) {
      return candidate;
    }
  }
  return null;
}

function parseModernLibraryVoice(input: unknown): LibraryVoice | null {
  if (!input || typeof input !== 'object') {
    return null;
  }
  const voice = input as ElevenLabsVoiceMetadata;
  const voiceId = voiceIdFromMetadata(voice);
  const name = typeof voice.name === 'string' ? voice.name.trim() : '';
  if (!voiceId || !name) {
    return null;
  }

  return {
    publicOwnerId: publicOwnerIdFromVoiceSharing(voice.sharing),
    voiceId,
    name,
    samples: voice.samples,
    previewUrl: previewUrlFromVoice(voice),
  };
}

function publicOwnerIdFromVoiceSharing(input: unknown): string | null {
  if (!input || typeof input !== 'object') {
    return null;
  }
  const sharing = input as ElevenLabsVoiceSharingMetadata;
  const publicOwnerId = typeof sharing.publicOwnerId === 'string'
    ? sharing.publicOwnerId
    : sharing.public_owner_id;
  if (typeof publicOwnerId !== 'string' || !publicOwnerId.trim()) {
    return null;
  }
  return publicOwnerId.trim();
}

async function fetchSharedVoice(input: {
  client: ElevenLabsSdkClient;
  voiceId: string;
  signal?: AbortSignal;
}): Promise<LibraryVoice> {
  const searchedPage = await fetchSharedVoicePage({
    client: input.client,
    search: input.voiceId,
    signal: input.signal,
  });
  const searchedVoice = findSharedVoice(searchedPage, input.voiceId);
  if (searchedVoice) {
    return searchedVoice;
  }

  for (let page = 0; page < MAX_SHARED_VOICE_PAGES; page += 1) {
    const sharedVoicePage = await fetchSharedVoicePage({
      client: input.client,
      page,
      signal: input.signal,
    });
    const sharedVoice = findSharedVoice(sharedVoicePage, input.voiceId);
    if (sharedVoice) {
      return sharedVoice;
    }
    if (hasMoreSharedVoices(sharedVoicePage) !== true) {
      break;
    }
  }

  throw createProviderError(
    SdkErrorCode.INVALID_VOICE,
    `ElevenLabs voice ${input.voiceId} was not found in account voices or shared voices.`,
    {
      kind: 'user_input',
      causedByUser: true,
      metadata: {
        maxSharedVoicePagesChecked: MAX_SHARED_VOICE_PAGES,
        sharedVoiceSearchHadMore: hasMoreSharedVoices(searchedPage),
      },
    }
  );
}

async function fetchSharedVoicePage(input: {
  client: ElevenLabsSdkClient;
  search?: string;
  page?: number;
  signal?: AbortSignal;
}): Promise<ElevenLabsSharedVoicesResponse> {
  const body = await input.client.voices.getShared(
    {
      pageSize: SHARED_VOICE_PAGE_SIZE,
      search: input.search,
      page: input.page,
    },
    { abortSignal: input.signal }
  ) as ElevenLabsSharedVoicesResponse;
  if (!Array.isArray(body.voices)) {
    throw unexpectedProviderResponse(
      'ElevenLabs shared voices response did not include a voices array.'
    );
  }
  return body;
}

function findSharedVoice(
  body: ElevenLabsSharedVoicesResponse,
  voiceId: string
): LibraryVoice | null {
  if (!Array.isArray(body.voices)) {
    return null;
  }
  for (const voice of body.voices) {
    const candidate = parseSharedVoice(voice);
    if (candidate?.voiceId === voiceId) {
      return candidate;
    }
  }
  return null;
}

function parseSharedVoice(input: unknown): LibraryVoice | null {
  if (!input || typeof input !== 'object') {
    return null;
  }
  const voice = input as ElevenLabsSharedVoiceMetadata;
  const voiceId = typeof voice.voiceId === 'string'
    ? voice.voiceId.trim()
    : typeof voice.voice_id === 'string'
      ? voice.voice_id.trim()
      : '';
  const publicOwnerId = typeof voice.publicOwnerId === 'string'
    ? voice.publicOwnerId.trim()
    : typeof voice.public_owner_id === 'string'
      ? voice.public_owner_id.trim()
      : '';
  const name = typeof voice.name === 'string' ? voice.name.trim() : '';
  const previewUrl = typeof voice.previewUrl === 'string'
    ? normalizePreviewUrl(voice.previewUrl)
    : typeof voice.preview_url === 'string'
      ? normalizePreviewUrl(voice.preview_url)
      : null;
  if (!voiceId || !name) {
    return null;
  }
  return { publicOwnerId: publicOwnerId || null, voiceId, name, previewUrl };
}

async function addSharedVoice(input: {
  client: ElevenLabsSdkClient;
  sharedVoice: { publicOwnerId: string; voiceId: string; name: string };
  signal?: AbortSignal;
}): Promise<string> {
  const response = await input.client.voices.share(
    input.sharedVoice.publicOwnerId,
    input.sharedVoice.voiceId,
    { newName: input.sharedVoice.name },
    { abortSignal: input.signal }
  ) as { voiceId?: unknown };
  if (typeof response.voiceId !== 'string' || !response.voiceId.trim()) {
    throw unexpectedProviderResponse(
      'ElevenLabs add shared voice response did not include a usable voiceId.'
    );
  }
  return response.voiceId.trim();
}

async function fetchResolvedVoiceSampleAudio(input: {
  client: ElevenLabsSdkClient;
  fetchOperation: typeof fetch;
  requestedVoiceId: string;
  resolvedVoice: ResolvedElevenLabsVoice;
  signal?: AbortSignal;
}): Promise<{
  sample: { sampleId: string; fileName: string | null };
  audioBytes: Buffer;
}> {
  if (input.resolvedVoice.previewSample) {
    return {
      sample: input.resolvedVoice.previewSample,
      audioBytes: await fetchAudioBytesFromUrl({
        fetchOperation: input.fetchOperation,
        url: input.resolvedVoice.previewSample.previewUrl,
        signal: input.signal,
      }),
    };
  }

  const sample = selectVoiceSample(input.resolvedVoice.metadata, input.requestedVoiceId);
  try {
    return {
      sample,
      audioBytes: await fetchVoiceSampleBytes({
        client: input.client,
        voiceId: input.resolvedVoice.audioVoiceId,
        sampleId: sample.sampleId,
        signal: input.signal,
      }),
    };
  } catch (error) {
    const previewSample = selectVoicePreviewSample(input.resolvedVoice.metadata);
    if (!previewSample || !isVoiceSampleUnavailableError(error)) {
      throw error;
    }
    return {
      sample: previewSample,
      audioBytes: await fetchAudioBytesFromUrl({
        fetchOperation: input.fetchOperation,
        url: previewSample.previewUrl,
        signal: input.signal,
      }),
    };
  }
}

function selectVoiceSample(
  metadata: ElevenLabsVoiceMetadata,
  voiceId: string
): { sampleId: string; fileName: string | null } {
  if (!Array.isArray(metadata.samples)) {
    throw missingVoiceSample(voiceId);
  }
  for (const sample of metadata.samples) {
    if (!sample || typeof sample !== 'object') {
      continue;
    }
    const candidate = sample as ElevenLabsVoiceSampleMetadata;
    const sampleId = typeof candidate.sampleId === 'string'
      ? candidate.sampleId.trim()
      : typeof candidate.sample_id === 'string'
        ? candidate.sample_id.trim()
        : '';
    if (sampleId) {
      return {
        sampleId,
        fileName: typeof candidate.fileName === 'string'
          ? candidate.fileName
          : typeof candidate.file_name === 'string'
            ? candidate.file_name
            : null,
      };
    }
  }
  throw missingVoiceSample(voiceId);
}

function selectVoicePreviewSample(
  metadata: ElevenLabsVoiceMetadata
): { sampleId: string; fileName: string | null; previewUrl: string } | null {
  const previewUrl = previewUrlFromVoice(metadata);
  return previewUrl ? previewSampleFromUrl(previewUrl) : null;
}

function voiceIdFromMetadata(metadata: ElevenLabsVoiceMetadata): string {
  const voiceId = typeof metadata.voiceId === 'string'
    ? metadata.voiceId
    : metadata.voice_id;
  return typeof voiceId === 'string' ? voiceId.trim() : '';
}

function previewUrlFromVoice(metadata: ElevenLabsVoiceMetadata): string | null {
  if (typeof metadata.previewUrl === 'string') {
    return normalizePreviewUrl(metadata.previewUrl);
  }
  if (typeof metadata.preview_url === 'string') {
    return normalizePreviewUrl(metadata.preview_url);
  }
  return null;
}

function previewSampleFromUrl(
  previewUrl: string
): { sampleId: string; fileName: string | null; previewUrl: string } {
  const fileName = fileNameFromUrl(previewUrl);
  return {
    sampleId: sampleIdFromFileName(fileName),
    fileName,
    previewUrl,
  };
}

function normalizePreviewUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function fileNameFromUrl(input: string): string | null {
  try {
    const fileName = new URL(input).pathname.split('/').filter(Boolean).pop();
    return fileName ? decodeURIComponent(fileName) : null;
  } catch {
    return null;
  }
}

function sampleIdFromFileName(fileName: string | null): string {
  const fallback = 'preview';
  if (!fileName) {
    return fallback;
  }
  const withoutExtension = fileName.replace(/\.[^.]+$/, '').trim();
  return withoutExtension || fallback;
}

async function fetchVoiceSampleBytes(input: {
  client: ElevenLabsSdkClient;
  voiceId: string;
  sampleId: string;
  signal?: AbortSignal;
}): Promise<Buffer> {
  const response = await input.client.voices.samples.audio.get(
    input.voiceId,
    input.sampleId,
    { abortSignal: input.signal }
  ).withRawResponse();
  assertAudioContentType(response.rawResponse.headers);
  return collectReadableStream(response.data);
}

async function fetchAudioBytesFromUrl(input: {
  fetchOperation: typeof fetch;
  url: string;
  signal?: AbortSignal;
}): Promise<Buffer> {
  const response = await input.fetchOperation(input.url, {
    method: 'GET',
    signal: input.signal,
  });
  await assertProviderResponse(response);
  return readPreviewAudioBytes(response);
}

async function collectReadableStream(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) {
        break;
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  const audioBytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  if (audioBytes.length === 0) {
    throw unexpectedProviderResponse('ElevenLabs voice sample audio response was empty.');
  }
  return audioBytes;
}

async function readAudioBytes(response: globalThis.Response): Promise<Buffer> {
  assertAudioContentType(response.headers);
  return readNonEmptyAudioBytes(response);
}

async function readPreviewAudioBytes(response: globalThis.Response): Promise<Buffer> {
  assertPreviewContentType(response.headers);
  const audioBytes = await readNonEmptyAudioBytes(response);
  if (!looksLikeMp3(audioBytes)) {
    throw unexpectedProviderResponse(
      'ElevenLabs voice preview URL returned bytes that do not look like MP3 audio.'
    );
  }
  return audioBytes;
}

async function readNonEmptyAudioBytes(response: globalThis.Response): Promise<Buffer> {
  const audioBytes = Buffer.from(await response.arrayBuffer());
  if (audioBytes.length === 0) {
    throw unexpectedProviderResponse('ElevenLabs voice sample audio response was empty.');
  }
  return audioBytes;
}

function assertAudioContentType(headers: globalThis.Headers): void {
  const contentType = headers.get('content-type');
  if (contentType && contentType.toLowerCase().includes('application/json')) {
    throw unexpectedProviderResponse(
      'ElevenLabs voice sample audio endpoint returned JSON instead of audio.'
    );
  }
  if (contentType && !contentType.toLowerCase().startsWith('audio/')) {
    throw unexpectedProviderResponse(
      `ElevenLabs voice sample audio endpoint returned unsupported content type: ${contentType}.`
    );
  }
}

function assertPreviewContentType(headers: globalThis.Headers): void {
  const contentType = headers.get('content-type');
  if (contentType && contentType.toLowerCase().includes('application/json')) {
    throw unexpectedProviderResponse(
      'ElevenLabs voice preview URL returned JSON instead of audio.'
    );
  }
}

function looksLikeMp3(audioBytes: Buffer): boolean {
  if (audioBytes.length < 3) {
    return false;
  }
  return (
    audioBytes.subarray(0, 3).toString('ascii') === 'ID3' ||
    (audioBytes[0] === 0xff && (audioBytes[1] & 0xe0) === 0xe0)
  );
}

async function assertProviderResponse(response: globalThis.Response): Promise<void> {
  if (response.ok) {
    return;
  }
  throw await readProviderError(response);
}

async function readProviderError(response: globalThis.Response): Promise<unknown> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  const body = await parseProviderErrorBody(response);
  return {
    status: response.status,
    headers,
    body,
    message: providerErrorMessage(body, response.status),
  };
}

async function parseProviderErrorBody(response: globalThis.Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('json')) {
    return await response.text();
  }
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function providerErrorMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const detail = (body as { detail?: unknown }).detail;
    if (detail && typeof detail === 'object') {
      const message = (detail as { message?: unknown }).message;
      if (typeof message === 'string') {
        return message;
      }
    }
  }
  return `HTTP status ${status}`;
}

function missingVoiceSample(voiceId: string): Error {
  return createProviderError(
    SdkErrorCode.INVALID_VOICE,
    `ElevenLabs voice metadata did not include a usable sample_id for voice ${voiceId}.`,
    { kind: 'user_input', causedByUser: true }
  );
}

function isVoiceNotFoundError(error: unknown): boolean {
  return parseElevenlabsError(error).code === 'voice_not_found';
}

function isVoiceSampleUnavailableError(error: unknown): boolean {
  const parsed = parseElevenlabsError(error);
  return parsed.code === 'voice_not_found' || /sample.+not/i.test(parsed.message);
}

function hasMoreSharedVoices(body: ElevenLabsSharedVoicesResponse): boolean {
  return body.hasMore === true || body.has_more === true;
}

function unexpectedProviderResponse(message: string): Error {
  return createProviderError(
    SdkErrorCode.PROVIDER_PREDICTION_FAILED,
    message,
    { kind: 'unknown' }
  );
}
