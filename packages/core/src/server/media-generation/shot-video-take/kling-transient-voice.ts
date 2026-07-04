import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  GenerationRequest,
  GenerationRunResult,
} from '@gorenku/studio-engines';
import { ProjectDataError } from '../../project-data-error.js';
import {
  assertResolvedPathInsideProject,
} from './project-media-files.js';
import type {
  KlingTransientVoiceConversion,
} from './provider-payloads.js';

export const KLING_TRANSIENT_VOICE_ID_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const KLING_TRANSIENT_VOICE_PROVIDER = 'fal-ai' as const;
const KLING_TRANSIENT_VOICE_MODEL = 'kling-video/create-voice' as const;
const KLING_TRANSIENT_VOICE_CACHE_PROJECT_PATH =
  '.renku/cache/kling-transient-voice-ids.json';
const KLING_TRANSIENT_VOICE_RESPONSE_PROJECT_ROOT =
  '.renku/cache/kling-transient-voice-responses';

export interface KlingTransientVoiceResolution {
  conversion: KlingTransientVoiceConversion;
  voiceId: string;
  cacheResult: 'hit' | 'miss' | 'skipped' | 'expired';
  sourceAudioFingerprint?: string;
  expiresAt?: string;
  simulated: boolean;
}

export interface KlingTransientVoiceResolutionReport {
  resolutions: KlingTransientVoiceResolution[];
  warnings: Array<Record<string, unknown>>;
}

interface KlingTransientVoiceCacheFile {
  version: 1;
  entries: KlingTransientVoiceCacheEntry[];
}

interface KlingTransientVoiceCacheEntry {
  provider: typeof KLING_TRANSIENT_VOICE_PROVIDER;
  model: typeof KLING_TRANSIENT_VOICE_MODEL;
  sourceAudioFingerprint: string;
  sourceAudioAssetFileId?: string;
  sourceProjectPath: string;
  voiceId: string;
  createdAt: string;
  expiresAt: string;
}

interface FingerprintedConversion {
  conversion: KlingTransientVoiceConversion;
  sourceAudioFingerprint?: string;
}

export async function fingerprintKlingTransientVoiceSource(input: {
  projectFolder: string;
  projectRelativePath: string;
}): Promise<string | undefined> {
  try {
    const absolutePath = path.resolve(input.projectFolder, input.projectRelativePath);
    assertResolvedPathInsideProject(input.projectFolder, absolutePath);
    const bytes = await fs.readFile(absolutePath);
    return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
  } catch {
    return undefined;
  }
}

export function klingTransientVoiceGenerationPolicy() {
  return {
    provider: KLING_TRANSIENT_VOICE_PROVIDER,
    model: KLING_TRANSIENT_VOICE_MODEL,
    mediaKind: 'json' as const,
    mode: 'json' as const,
    outputCount: 1,
  };
}

export function klingTransientVoiceGenerationRequest(
  conversion: KlingTransientVoiceConversion
): GenerationRequest {
  return {
    inputFiles: [
      {
        field: 'voice_url',
        projectRelativePath: conversion.sourceAudio.projectRelativePath,
        mediaKind: 'audio',
        required: true,
      },
    ],
    parameters: {},
    outputNames: [
      `${safeTransientVoiceOutputStem(
        conversion.sourceAudio.assetFileId
      )}-kling-transient-voice.json`,
    ],
  };
}

export async function resolveKlingTransientVoices(input: {
  projectFolder: string;
  conversions: KlingTransientVoiceConversion[];
  simulate: boolean;
  runGeneration: (input: {
    policy: ReturnType<typeof klingTransientVoiceGenerationPolicy>;
    request: GenerationRequest;
    mode: 'live' | 'simulated';
    outputRoot: string;
    outputProjectRelativeRoot: string;
    inputRoot: string;
  }) => Promise<GenerationRunResult>;
}): Promise<KlingTransientVoiceResolutionReport> {
  const fingerprints = await fingerprintConversions(input);
  if (input.simulate) {
    return {
      resolutions: fingerprints.map((entry) => ({
        conversion: entry.conversion,
        voiceId: simulatedVoiceId(entry),
        cacheResult: entry.sourceAudioFingerprint ? 'skipped' : 'skipped',
        sourceAudioFingerprint: entry.sourceAudioFingerprint,
        simulated: true,
      })),
      warnings: [],
    };
  }
  const cache = await readKlingTransientVoiceCache(input.projectFolder);
  const now = new Date();
  const warnings: Array<Record<string, unknown>> = [];
  const freshEntries = new Map(
    cache.entries
      .filter((entry) => isFreshCacheEntry(entry, now))
      .map((entry) => [cacheKey(entry.sourceAudioFingerprint), entry])
  );
  const resolutions: KlingTransientVoiceResolution[] = [];
  const liveMisses = new Map<string, FingerprintedConversion>();
  for (const entry of fingerprints) {
    if (!entry.sourceAudioFingerprint) {
      liveMisses.set(fingerprintedConversionKey(entry), entry);
      resolutions.push({
        conversion: entry.conversion,
        voiceId: '',
        cacheResult: 'skipped',
        simulated: false,
      });
      continue;
    }
    const cached = freshEntries.get(cacheKey(entry.sourceAudioFingerprint));
    if (cached) {
      resolutions.push({
        conversion: entry.conversion,
        voiceId: cached.voiceId,
        cacheResult: 'hit',
        sourceAudioFingerprint: entry.sourceAudioFingerprint,
        expiresAt: cached.expiresAt,
        simulated: false,
      });
      continue;
    }
    liveMisses.set(fingerprintedConversionKey(entry), entry);
    const expired = findCacheEntry(cache.entries, entry.sourceAudioFingerprint);
    resolutions.push({
      conversion: entry.conversion,
      voiceId: '',
      cacheResult: expired ? 'expired' : 'miss',
      sourceAudioFingerprint: entry.sourceAudioFingerprint,
      simulated: false,
    });
  }
  const freshEntriesToWrite: KlingTransientVoiceCacheEntry[] = [];
  for (const miss of liveMisses.values()) {
    const request = klingTransientVoiceGenerationRequest(miss.conversion);
    const result = await input.runGeneration({
      policy: klingTransientVoiceGenerationPolicy(),
      request,
      mode: 'live',
      outputRoot: path.join(input.projectFolder, KLING_TRANSIENT_VOICE_RESPONSE_PROJECT_ROOT),
      outputProjectRelativeRoot: KLING_TRANSIENT_VOICE_RESPONSE_PROJECT_ROOT,
      inputRoot: input.projectFolder,
    });
    const voiceId = await readVoiceIdFromCreateVoiceResult({
      projectFolder: input.projectFolder,
      result,
    });
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(
      Date.parse(createdAt) + KLING_TRANSIENT_VOICE_ID_CACHE_TTL_MS
    ).toISOString();
    for (const resolution of resolutions) {
      if (resolutionMatchesLiveMiss(resolution, miss)) {
        resolution.voiceId = voiceId;
        resolution.expiresAt = expiresAt;
      }
    }
    if (miss.sourceAudioFingerprint) {
      freshEntriesToWrite.push({
        provider: KLING_TRANSIENT_VOICE_PROVIDER,
        model: KLING_TRANSIENT_VOICE_MODEL,
        sourceAudioFingerprint: miss.sourceAudioFingerprint,
        sourceAudioAssetFileId: miss.conversion.sourceAudio.assetFileId,
        sourceProjectPath: miss.conversion.sourceAudio.projectRelativePath,
        voiceId,
        createdAt,
        expiresAt,
      });
    }
  }
  if (freshEntriesToWrite.length > 0) {
    const writeWarning = await writeKlingTransientVoiceCache(input.projectFolder, [
      ...cache.entries.filter((entry) => isFreshCacheEntry(entry, now)),
      ...freshEntriesToWrite,
    ]);
    if (writeWarning) {
      warnings.push(writeWarning);
    }
  }
  return { resolutions, warnings };
}

export function injectKlingTransientVoiceIds(input: {
  payload: Record<string, unknown>;
  requestParameters: Record<string, unknown>;
  resolutions: KlingTransientVoiceResolution[];
}): void {
  for (const resolution of input.resolutions) {
    if (!resolution.voiceId) {
      throw new ProjectDataError(
        'CORE_SHOT_VIDEO_KLING_TRANSIENT_VOICE_ID_MISSING',
        'Kling transient voice conversion did not produce a voice_id.'
      );
    }
    setPayloadPath(input.payload, resolution.conversion.payloadPath, resolution.voiceId);
    setPayloadPath(
      input.requestParameters,
      resolution.conversion.payloadPath,
      resolution.voiceId
    );
  }
}

export function klingTransientVoiceCacheProjectPath(): string {
  return KLING_TRANSIENT_VOICE_CACHE_PROJECT_PATH;
}

async function fingerprintConversions(input: {
  projectFolder: string;
  conversions: KlingTransientVoiceConversion[];
}): Promise<FingerprintedConversion[]> {
  return Promise.all(
    input.conversions.map(async (conversion) => ({
      conversion,
      sourceAudioFingerprint: await fingerprintKlingTransientVoiceSource({
        projectFolder: input.projectFolder,
        projectRelativePath: conversion.sourceAudio.projectRelativePath,
      }),
    }))
  );
}

async function readKlingTransientVoiceCache(
  projectFolder: string
): Promise<KlingTransientVoiceCacheFile> {
  try {
    const parsed = JSON.parse(
      await fs.readFile(cacheAbsolutePath(projectFolder), 'utf8')
    ) as Partial<KlingTransientVoiceCacheFile>;
    if (parsed.version !== 1 || !Array.isArray(parsed.entries)) {
      return emptyCache();
    }
    return {
      version: 1,
      entries: parsed.entries.filter(isCacheEntry),
    };
  } catch {
    return emptyCache();
  }
}

async function writeKlingTransientVoiceCache(
  projectFolder: string,
  entries: KlingTransientVoiceCacheEntry[]
): Promise<Record<string, unknown> | null> {
  const cachePath = cacheAbsolutePath(projectFolder);
  const cacheDir = path.dirname(cachePath);
  const tempPath = path.join(
    cacheDir,
    `kling-transient-voice-ids.${process.pid}.${Date.now()}.tmp`
  );
  try {
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(
      tempPath,
      `${JSON.stringify({ version: 1, entries }, null, 2)}\n`
    );
    await fs.rename(tempPath, cachePath);
    return null;
  } catch (error) {
    return {
      code: 'CORE_SHOT_VIDEO_KLING_TRANSIENT_VOICE_CACHE_WRITE_FAILED',
      message:
        'Kling transient voice_id cache could not be written; generation continued.',
      cacheProjectPath: KLING_TRANSIENT_VOICE_CACHE_PROJECT_PATH,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

function emptyCache(): KlingTransientVoiceCacheFile {
  return { version: 1, entries: [] };
}

function cacheAbsolutePath(projectFolder: string): string {
  return path.join(projectFolder, KLING_TRANSIENT_VOICE_CACHE_PROJECT_PATH);
}

function isCacheEntry(input: unknown): input is KlingTransientVoiceCacheEntry {
  if (!input || typeof input !== 'object') {
    return false;
  }
  const entry = input as Partial<KlingTransientVoiceCacheEntry>;
  return (
    entry.provider === KLING_TRANSIENT_VOICE_PROVIDER &&
    entry.model === KLING_TRANSIENT_VOICE_MODEL &&
    typeof entry.sourceAudioFingerprint === 'string' &&
    typeof entry.sourceProjectPath === 'string' &&
    typeof entry.voiceId === 'string' &&
    typeof entry.createdAt === 'string' &&
    typeof entry.expiresAt === 'string'
  );
}

function findCacheEntry(
  entries: KlingTransientVoiceCacheEntry[],
  sourceAudioFingerprint: string
): KlingTransientVoiceCacheEntry | undefined {
  return entries.find(
    (entry) =>
      entry.provider === KLING_TRANSIENT_VOICE_PROVIDER &&
      entry.model === KLING_TRANSIENT_VOICE_MODEL &&
      entry.sourceAudioFingerprint === sourceAudioFingerprint
  );
}

function isFreshCacheEntry(
  entry: KlingTransientVoiceCacheEntry,
  now: Date
): boolean {
  const expiresAt = Date.parse(entry.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > now.getTime();
}

async function readVoiceIdFromCreateVoiceResult(input: {
  projectFolder: string;
  result: GenerationRunResult;
}): Promise<string> {
  const output = input.result.outputs.find((candidate) =>
    candidate.projectRelativePath?.endsWith('.json')
  );
  if (!output?.projectRelativePath) {
    throw missingVoiceId();
  }
  const absolutePath = path.resolve(input.projectFolder, output.projectRelativePath);
  assertResolvedPathInsideProject(input.projectFolder, absolutePath);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await fs.readFile(absolutePath, 'utf8'));
  } catch {
    throw missingVoiceId();
  }
  const voiceId =
    parsed && typeof parsed === 'object'
      ? (parsed as { voice_id?: unknown }).voice_id
      : undefined;
  if (typeof voiceId !== 'string' || !voiceId.trim()) {
    throw missingVoiceId();
  }
  return voiceId.trim();
}

function missingVoiceId(): ProjectDataError {
  return new ProjectDataError(
    'CORE_SHOT_VIDEO_KLING_TRANSIENT_VOICE_ID_MISSING',
    'Kling create-voice output did not include voice_id.'
  );
}

function setPayloadPath(
  payload: Record<string, unknown>,
  payloadPath: Array<string | number>,
  value: string
): void {
  let current: Record<string | number, unknown> = payload;
  for (const [index, segment] of payloadPath.entries()) {
    if (index === payloadPath.length - 1) {
      current[segment] = value;
      return;
    }
    const next = current[segment];
    if (!next || typeof next !== 'object') {
      throw new ProjectDataError(
        'CORE_SHOT_VIDEO_KLING_TRANSIENT_VOICE_PAYLOAD_PATH_INVALID',
        `Kling transient voice payload path is invalid: ${payloadPath.join('.')}.`
      );
    }
    current = next as Record<string | number, unknown>;
  }
}

function sameSource(
  left: KlingTransientVoiceConversion,
  right: KlingTransientVoiceConversion
): boolean {
  return (
    left.sourceAudio.assetFileId === right.sourceAudio.assetFileId &&
    left.sourceAudio.projectRelativePath === right.sourceAudio.projectRelativePath
  );
}

function resolutionMatchesLiveMiss(
  resolution: KlingTransientVoiceResolution,
  miss: FingerprintedConversion
): boolean {
  if (miss.sourceAudioFingerprint) {
    return (
      resolution.sourceAudioFingerprint === miss.sourceAudioFingerprint
    );
  }
  return sameSource(resolution.conversion, miss.conversion);
}

function simulatedVoiceId(entry: FingerprintedConversion): string {
  const basis =
    entry.sourceAudioFingerprint ??
    `${entry.conversion.sourceAudio.assetFileId}:${entry.conversion.sourceAudio.projectRelativePath}`;
  return `simulated_kling_voice_${crypto
    .createHash('sha256')
    .update(basis)
    .digest('hex')
    .slice(0, 16)}`;
}

function fingerprintedConversionKey(entry: FingerprintedConversion): string {
  return entry.sourceAudioFingerprint
    ? cacheKey(entry.sourceAudioFingerprint)
    : uniqueConversionKey(entry);
}

function uniqueConversionKey(entry: FingerprintedConversion): string {
  return [
    entry.conversion.sourceAudio.assetFileId,
    entry.conversion.sourceAudio.projectRelativePath,
  ].join(':');
}

function cacheKey(sourceAudioFingerprint: string): string {
  return [
    KLING_TRANSIENT_VOICE_PROVIDER,
    KLING_TRANSIENT_VOICE_MODEL,
    sourceAudioFingerprint,
  ].join(':');
}

function safeTransientVoiceOutputStem(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') ||
    'dialogue-audio';
}
