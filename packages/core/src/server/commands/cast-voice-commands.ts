import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchElevenLabsVoiceSampleAudio } from '@gorenku/studio-engines';
import type {
  Asset,
  CastVoice,
  CastVoiceAttachmentCommandDocument,
  CastVoiceAttachmentReport,
  CastVoiceListReport,
  CastVoiceReadReport,
  CastVoiceRemoveReport,
  CastVoiceSampleSource,
  CastVoiceValidationReport,
} from '../../client/index.js';
import type { ElevenLabsVoiceSampleFetcher } from '../project-data-service-contracts.js';
import { insertAssetFileRecord } from '../database/access/asset-files.js';
import { insertAssetRecord } from '../database/access/assets.js';
import {
  deleteAssetRelationshipRecord,
  insertAssetRelationshipRecord,
  nextAssetRelationshipSortOrder,
  readAssetRelationship,
} from '../database/access/asset-relationships/index.js';
import { readCastMemberRecord } from '../database/access/cast-members.js';
import { readProjectRecord } from '../database/access/project.js';
import {
  castVoiceNameExists,
  deleteCastVoiceRecord,
  insertCastVoiceRecord,
  listCastVoiceRecords,
  nextCastVoiceSortOrder,
  readCastVoiceRecord,
  readCastVoiceRecordBySampleAssetId,
  type CastVoiceRecord,
} from '../database/access/cast-voices.js';
import { deleteAssetFileRecordsForAsset } from '../database/access/asset-files.js';
import { deleteAssetRecord } from '../database/access/assets.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
  type ProjectIdGenerator,
} from '../entity-ids.js';
import { CAST_ROOT } from '../files/asset-paths.js';
import {
  joinProjectRelativePath,
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';
import { ProjectDataError } from '../project-data-error.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';
import { studioResourceKeysForAssetTarget } from '../studio-coordination/resource-keys.js';

const DIRECT_ELEVENLABS_TTS_MODELS = new Set([
  'eleven_v3',
  'eleven_multilingual_v2',
  'eleven_turbo_v2_5',
]);

const AUDIO_EXTENSIONS = new Map([
  ['.mp3', 'audio/mpeg'],
  ['.wav', 'audio/wav'],
  ['.m4a', 'audio/mp4'],
]);

export interface CastVoiceProjectInput extends RenkuConfigPathOptions {
  projectName?: string;
}

export interface CastVoiceTargetInput extends CastVoiceProjectInput {
  castMemberId: string;
}

export interface CastVoiceLookupInput extends CastVoiceTargetInput {
  voiceIdOrName: string;
}

export interface CastVoiceAttachmentInput extends CastVoiceProjectInput {
  document: CastVoiceAttachmentCommandDocument;
  idGenerator?: ProjectIdGenerator;
  elevenLabsVoiceSampleFetcher?: ElevenLabsVoiceSampleFetcher;
}

export async function listCastVoices(
  input: CastVoiceTargetInput
): Promise<CastVoiceListReport> {
  return withCastVoiceProjectSession(input, ({ session }) => {
    requireCastMember(session, input.castMemberId);
    return {
      voices: listCastVoiceRecords(session, input.castMemberId).map((record) =>
        toCastVoice(session, record)
      ),
    };
  });
}

export async function readCastVoice(
  input: CastVoiceLookupInput
): Promise<CastVoiceReadReport> {
  return withCastVoiceProjectSession(input, ({ session }) => {
    requireCastMember(session, input.castMemberId);
    const record = requireCastVoiceRecord(session, input);
    return { voice: toCastVoice(session, record) };
  });
}

export async function validateCastVoiceAttachment(
  input: CastVoiceAttachmentInput
): Promise<CastVoiceValidationReport> {
  return withCastVoiceProjectSession(input, async ({ currentProject, projectFolder, session }) => {
    await validateAttachmentDocument({
      projectFolder,
      session,
      document: input.document,
    });
    return { valid: true, warnings: [] };
  });
}

export async function attachCastVoice(
  input: CastVoiceAttachmentInput
): Promise<CastVoiceAttachmentReport> {
  return withCastVoiceProjectSession(
    input,
    async ({ currentProject, projectFolder, session }) => {
    const validated = await validateAttachmentDocument({
      projectFolder,
      session,
      document: input.document,
    });
    const prepared = await prepareCastVoiceSampleAttachment({
      projectFolder,
      validated,
      document: input.document,
      elevenLabsVoiceSampleFetcher: input.elevenLabsVoiceSampleFetcher,
    });
    const inserted = await insertCastVoiceWithSampleAsset({
      projectFolder,
      session,
      validated,
      prepared,
      idGenerator: input.idGenerator,
    });

    const record = requireCastVoiceRecord(session, {
      castMemberId: validated.castMember.id,
      voiceIdOrName: inserted.voiceId,
    });
    const voice = toCastVoice(session, record);
    const resourceKeys = studioResourceKeysForAssetTarget(inserted.target);
    return {
      valid: true,
      warnings: [],
      project: {
        id: currentProject.projectId,
        name: currentProject.projectName,
      },
      castMember: {
        id: validated.castMember.id,
        handle: validated.castMember.handle,
        name: validated.castMember.name,
      },
      voice,
      sampleRetrieval: prepared.sampleRetrieval,
      changes: [
        {
          type: 'castVoice.attached',
          castMemberId: validated.castMember.id,
          voiceId: voice.id,
        },
      ],
      resourceKeys,
    };
    }
  );
}

export async function removeCastVoice(
  input: CastVoiceLookupInput
): Promise<CastVoiceRemoveReport> {
  return withCastVoiceProjectSession(input, async ({ currentProject, projectFolder, session }) => {
    requireCastMember(session, input.castMemberId);
    const record = requireCastVoiceRecord(session, input);
    const target = { kind: 'castMember' as const, castMemberId: input.castMemberId };
    const sample = readAssetRelationship(session, {
      target,
      assetId: record.sampleAssetId,
    });
    if (!sample) {
      throw new ProjectDataError(
        'PROJECT_DATA352',
        `Cast Voice sample asset is missing: ${record.sampleAssetId}.`
      );
    }
    await deleteAssetFiles(projectFolder, sample);
    session.db.transaction((tx) => {
      const txSession = { ...session, db: tx };
      deleteCastVoiceRecord(txSession, {
        castMemberId: input.castMemberId,
        voiceId: record.id,
      });
      deleteAssetRelationshipRecord(txSession, {
        target,
        assetId: record.sampleAssetId,
      });
      deleteAssetFileRecordsForAsset(txSession, record.sampleAssetId);
      deleteAssetRecord(txSession, record.sampleAssetId);
    });
    return {
      project: {
        id: currentProject.projectId,
        name: currentProject.projectName,
      },
      removed: {
        castMemberId: input.castMemberId,
        voiceId: record.id,
        sampleAssetId: record.sampleAssetId,
      },
      changes: [
        {
          type: 'castVoice.removed',
          castMemberId: input.castMemberId,
          voiceId: record.id,
        },
      ],
      resourceKeys: studioResourceKeysForAssetTarget(target),
    };
  });
}

export function assertAssetIsNotCastVoiceSample(
  session: Parameters<typeof readCastVoiceRecordBySampleAssetId>[0],
  assetId: string
): void {
  const voice = readCastVoiceRecordBySampleAssetId(session, assetId);
  if (!voice) {
    return;
  }
  throw new ProjectDataError(
    'PROJECT_DATA353',
    `Asset ${assetId} is linked to Cast Voice ${voice.id} and cannot be deleted directly.`,
    { suggestion: 'Remove the Cast Voice first.' }
  );
}

function toCastVoice(session: Parameters<typeof readAssetRelationship>[0], record: CastVoiceRecord): CastVoice {
  const sample = readAssetRelationship(session, {
    target: { kind: 'castMember', castMemberId: record.castMemberId },
    assetId: record.sampleAssetId,
  });
  if (!sample) {
    throw new ProjectDataError(
      'PROJECT_DATA352',
      `Cast Voice sample asset is missing: ${record.sampleAssetId}.`
    );
  }
  return {
    id: record.id,
    castMemberId: record.castMemberId,
    name: record.name,
    provider: record.provider,
    model: record.model,
    voiceId: record.voiceId,
    purpose: record.purpose,
    sampleSource: toCastVoiceSampleSource(record),
    sample: {
      ...sample,
      files: sample.files.filter((file) => file.mediaKind === 'audio'),
    },
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

interface ValidatedCastVoiceAttachment {
  castMember: ReturnType<typeof requireCastMember>;
  name: string;
  provider: string;
  model: string;
  voiceId: string;
  purpose: string;
  sampleTitle: string;
  fileSample?: {
    sourceProjectRelativePath: string;
    receipt?: unknown;
    mimeType: string;
    sizeBytes: number;
  };
}

interface PreparedCastVoiceSample {
  destinationProjectRelativePath: string;
  mimeType: string;
  sizeBytes: number;
  contentHash: string;
  origin: 'imported' | 'generated' | 'elevenlabs_sample';
  sampleSource: CastVoiceSampleSource;
  sampleRetrieval?: CastVoiceAttachmentReport['sampleRetrieval'];
}

async function validateAttachmentDocument(input: {
  projectFolder: string;
  session: Parameters<typeof readCastMemberRecord>[0];
  document: CastVoiceAttachmentCommandDocument;
}): Promise<ValidatedCastVoiceAttachment> {
  const document = input.document;
  if (
    document.kind !== 'castVoiceAttachment' &&
    document.kind !== 'castVoiceElevenLabsSampleAttachment'
  ) {
    throw new ProjectDataError(
      'PROJECT_DATA340',
      'Cast Voice attachment kind must be castVoiceAttachment or castVoiceElevenLabsSampleAttachment.'
    );
  }
  const castMember = requireCastMember(input.session, document.castMemberId);
  const name = requiredReferenceName(document.name);
  if (castVoiceNameExists(input.session, { castMemberId: castMember.id, name })) {
    throw new ProjectDataError(
      'PROJECT_DATA341',
      `Cast Member ${castMember.id} already has a Cast Voice named ${name}.`
    );
  }
  const provider = requiredTrimmed(document.provider, 'provider');
  if (provider !== 'elevenlabs') {
    throw new ProjectDataError(
      'PROJECT_DATA342',
      `Unsupported Cast Voice provider: ${provider}.`
    );
  }
  const model = requiredTrimmed(document.model, 'model');
  if (!DIRECT_ELEVENLABS_TTS_MODELS.has(model)) {
    throw new ProjectDataError(
      'PROJECT_DATA343',
      `Unsupported Cast Voice model: ${model}.`
    );
  }
  const voiceId = requiredTrimmed(document.voiceId, 'voiceId');
  const purpose = requiredTrimmed(document.purpose, 'purpose');
  const sample = document.sample;
  if (!sample) {
    throw new ProjectDataError('PROJECT_DATA344', 'Cast Voice sample is required.');
  }
  const sampleTitle = requiredTrimmed(sample.title, 'sample.title');
  if (document.kind === 'castVoiceElevenLabsSampleAttachment') {
    assertProviderSampleDocumentHasNoFileFields(sample);
    return {
      castMember,
      name,
      provider,
      model,
      voiceId,
      purpose,
      sampleTitle,
    };
  }
  assertReceiptMatchesVoice({
    receipt: document.sample.receipt,
    provider,
    model,
    voiceId,
  });
  const sourceProjectRelativePath = normalizeProjectRelativePath(
    document.sample.sourceProjectRelativePath
  );
  const sourcePath = resolveProjectRelativePath(
    input.projectFolder,
    sourceProjectRelativePath
  );
  assertResolvedPathInsideProject(input.projectFolder, sourcePath);
  const stats = await statExistingFile(sourcePath);
  const mimeType = mimeTypeForAudioPath(sourceProjectRelativePath);
  return {
    castMember,
    name,
    provider,
    model,
    voiceId,
    purpose,
    sampleTitle,
    fileSample: {
      sourceProjectRelativePath,
      receipt: document.sample.receipt,
      mimeType,
      sizeBytes: stats.size,
    },
  };
}

async function prepareCastVoiceSampleAttachment(input: {
  projectFolder: string;
  validated: ValidatedCastVoiceAttachment;
  document: CastVoiceAttachmentCommandDocument;
  elevenLabsVoiceSampleFetcher?: ElevenLabsVoiceSampleFetcher;
}): Promise<PreparedCastVoiceSample> {
  if (input.document.kind === 'castVoiceElevenLabsSampleAttachment') {
    return prepareElevenLabsVoiceSampleAttachment(input);
  }
  return prepareFileCastVoiceAttachment(input);
}

async function prepareFileCastVoiceAttachment(input: {
  projectFolder: string;
  validated: ValidatedCastVoiceAttachment;
}): Promise<PreparedCastVoiceSample> {
  const fileSample = input.validated.fileSample;
  if (!fileSample) {
    throw new ProjectDataError('PROJECT_DATA344', 'Cast Voice file sample is required.');
  }
  const destinationProjectRelativePath = await allocateCastVoiceSamplePath({
    projectFolder: input.projectFolder,
    castMemberHandle: input.validated.castMember.handle,
    sourceProjectRelativePath: fileSample.sourceProjectRelativePath,
  });
  const sourcePath = resolveProjectRelativePath(
    input.projectFolder,
    fileSample.sourceProjectRelativePath as never
  );
  const destinationPath = resolveProjectRelativePath(
    input.projectFolder,
    destinationProjectRelativePath as never
  );
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  if (sourcePath !== destinationPath) {
    await fs.copyFile(sourcePath, destinationPath);
  }
  return {
    destinationProjectRelativePath,
    mimeType: fileSample.mimeType,
    sizeBytes: fileSample.sizeBytes,
    contentHash: await hashFile(destinationPath),
    origin: fileSample.receipt ? 'generated' : 'imported',
    sampleSource: fileSample.receipt
      ? { kind: 'generated_sample' }
      : { kind: 'custom_file' },
  };
}

async function prepareElevenLabsVoiceSampleAttachment(input: {
  projectFolder: string;
  validated: ValidatedCastVoiceAttachment;
  elevenLabsVoiceSampleFetcher?: ElevenLabsVoiceSampleFetcher;
}): Promise<PreparedCastVoiceSample> {
  const fetcher = input.elevenLabsVoiceSampleFetcher ?? fetchElevenLabsVoiceSampleAudio;
  const fetched = await fetcher({ voiceId: input.validated.voiceId });
  const destinationProjectRelativePath = await allocateCastVoiceSamplePath({
    projectFolder: input.projectFolder,
    castMemberHandle: input.validated.castMember.handle,
    sourceProjectRelativePath: `${input.validated.name}.mp3`,
  });
  const destinationPath = resolveProjectRelativePath(
    input.projectFolder,
    destinationProjectRelativePath
  );
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.writeFile(destinationPath, fetched.audioBytes);
  const sampleRetrieval = {
    provider: 'elevenlabs' as const,
    voiceId: fetched.voiceId,
    sampleId: fetched.sampleId,
    mimeType: 'audio/mpeg' as const,
    sizeBytes: fetched.audioBytes.length,
    fetchedAt: fetched.fetchedAt,
    apiBaseUrl: fetched.apiBaseUrl,
  };
  return {
    destinationProjectRelativePath,
    mimeType: 'audio/mpeg',
    sizeBytes: fetched.audioBytes.length,
    contentHash: hashBuffer(fetched.audioBytes),
    origin: 'elevenlabs_sample',
    sampleSource: {
      kind: 'elevenlabs_voice_sample',
      sampleId: fetched.sampleId,
      fetchedAt: fetched.fetchedAt,
      apiBaseUrl: fetched.apiBaseUrl,
    },
    sampleRetrieval,
  };
}

async function insertCastVoiceWithSampleAsset(input: {
  projectFolder: string;
  session: DatabaseSession;
  validated: ValidatedCastVoiceAttachment;
  prepared: PreparedCastVoiceSample;
  idGenerator?: ProjectIdGenerator;
}): Promise<{
  voiceId: string;
  target: { kind: 'castMember'; castMemberId: string };
}> {
  const now = new Date().toISOString();
  const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
  const target = {
    kind: 'castMember' as const,
    castMemberId: input.validated.castMember.id,
  };
  const assetId = ids('asset');
  const assetFileId = ids('asset_file');
  const relationshipId = ids('cast_asset');
  const voiceId = ids('cast_voice');
  try {
    input.session.db.transaction((tx) => {
      const txSession = { ...input.session, db: tx };
      insertAssetRecord(txSession, {
        id: assetId,
        type: 'cast_voice_sample',
        mediaKind: 'audio',
        title: input.validated.sampleTitle,
        origin: input.prepared.origin,
        availability: 'ready',
        createdAt: now,
        updatedAt: now,
      });
      insertAssetFileRecord(txSession, {
        id: assetFileId,
        assetId,
        role: 'primary',
        projectRelativePath: input.prepared.destinationProjectRelativePath,
        mimeType: input.prepared.mimeType,
        mediaKind: 'audio',
        sizeBytes: input.prepared.sizeBytes,
        contentHash: input.prepared.contentHash,
        createdAt: now,
        updatedAt: now,
      });
      insertAssetRelationshipRecord(txSession, target, {
        relationshipId,
        assetId,
        localeId: null,
        role: 'voice_sample',
        referenceName: input.validated.name,
        purpose: input.validated.purpose,
        sortOrder: nextAssetRelationshipSortOrder(txSession, {
          target,
          role: 'voice_sample',
          localeId: null,
        }),
        now,
      });
      insertCastVoiceRecord(txSession, {
        id: voiceId,
        castMemberId: input.validated.castMember.id,
        name: input.validated.name,
        provider: input.validated.provider,
        model: input.validated.model,
        voiceId: input.validated.voiceId,
        purpose: input.validated.purpose,
        sampleAssetId: assetId,
        sampleSourceKind: input.prepared.sampleSource.kind,
        sampleId: input.prepared.sampleSource.kind === 'elevenlabs_voice_sample'
          ? input.prepared.sampleSource.sampleId
          : null,
        sampleFetchedAt: input.prepared.sampleSource.kind === 'elevenlabs_voice_sample'
          ? input.prepared.sampleSource.fetchedAt
          : null,
        sampleApiBaseUrl: input.prepared.sampleSource.kind === 'elevenlabs_voice_sample'
          ? input.prepared.sampleSource.apiBaseUrl
          : null,
        sortOrder: nextCastVoiceSortOrder(txSession, input.validated.castMember.id),
        createdAt: now,
        updatedAt: now,
      });
    });
  } catch (error) {
    await fs.rm(
      resolveProjectRelativePath(
        input.projectFolder,
        input.prepared.destinationProjectRelativePath as never
      ),
      { force: true }
    );
    throw error;
  }
  return { voiceId, target };
}

function requireCastMember(session: Parameters<typeof readCastMemberRecord>[0], castMemberId: string) {
  const castMember = readCastMemberRecord(session, castMemberId);
  if (!castMember) {
    throw new ProjectDataError(
      'PROJECT_DATA340',
      `Cast member was not found: ${castMemberId}.`
    );
  }
  return castMember;
}

function requireCastVoiceRecord(
  session: Parameters<typeof readCastVoiceRecord>[0],
  input: { castMemberId: string; voiceIdOrName: string }
): CastVoiceRecord {
  const record = readCastVoiceRecord(session, input);
  if (!record) {
    throw new ProjectDataError(
      'PROJECT_DATA350',
      `Cast Voice was not found for Cast Member ${input.castMemberId}: ${input.voiceIdOrName}.`
    );
  }
  return record;
}

function requiredReferenceName(input: string): string {
  const value = requiredTrimmed(input, 'name');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new ProjectDataError(
      'PROJECT_DATA345',
      `Cast Voice reference name must use lower-case letters, numbers, and single hyphen separators: ${value}.`
    );
  }
  return value;
}

function assertReceiptMatchesVoice(input: {
  receipt: unknown;
  provider: string;
  model: string;
  voiceId: string;
}): void {
  const receipt = unwrapReceiptRun(input.receipt);
  if (!receipt) {
    return;
  }
  if (
    typeof receipt.provider === 'string' &&
    receipt.provider !== input.provider
  ) {
    throw new ProjectDataError(
      'PROJECT_DATA354',
      `Cast Voice receipt provider ${receipt.provider} does not match attachment provider ${input.provider}.`
    );
  }
  if (typeof receipt.model === 'string' && receipt.model !== input.model) {
    throw new ProjectDataError(
      'PROJECT_DATA354',
      `Cast Voice receipt model ${receipt.model} does not match attachment model ${input.model}.`
    );
  }
  const providerPayload = receipt.providerPayload;
  if (!providerPayload || typeof providerPayload !== 'object') {
    return;
  }
  const receiptVoice = (providerPayload as Record<string, unknown>).voice;
  if (typeof receiptVoice === 'string' && receiptVoice !== input.voiceId) {
    throw new ProjectDataError(
      'PROJECT_DATA354',
      `Cast Voice receipt voice ${receiptVoice} does not match attachment voiceId ${input.voiceId}.`
    );
  }
}

function unwrapReceiptRun(
  receipt: unknown
): { provider?: unknown; model?: unknown; providerPayload?: unknown } | null {
  if (!receipt || typeof receipt !== 'object') {
    return null;
  }
  if ('run' in receipt) {
    const run = (receipt as { run?: unknown }).run;
    return run && typeof run === 'object'
      ? (run as { provider?: unknown; model?: unknown; providerPayload?: unknown })
      : null;
  }
  return receipt as { provider?: unknown; model?: unknown; providerPayload?: unknown };
}

function assertProviderSampleDocumentHasNoFileFields(sample: object): void {
  if ('sourceProjectRelativePath' in sample) {
    throw new ProjectDataError(
      'PROJECT_DATA355',
      'ElevenLabs provider sample attachments must not include sample.sourceProjectRelativePath.'
    );
  }
  if ('receipt' in sample) {
    throw new ProjectDataError(
      'PROJECT_DATA356',
      'ElevenLabs provider sample attachments must not include sample.receipt.'
    );
  }
}

function toCastVoiceSampleSource(record: CastVoiceRecord): CastVoiceSampleSource {
  if (record.sampleSourceKind === 'custom_file') {
    return { kind: 'custom_file' };
  }
  if (record.sampleSourceKind === 'generated_sample') {
    return { kind: 'generated_sample' };
  }
  if (record.sampleSourceKind === 'elevenlabs_voice_sample') {
    if (!record.sampleId || !record.sampleFetchedAt || !record.sampleApiBaseUrl) {
      throw new ProjectDataError(
        'PROJECT_DATA357',
        `Cast Voice ${record.id} is missing ElevenLabs sample provenance.`
      );
    }
    return {
      kind: 'elevenlabs_voice_sample',
      sampleId: record.sampleId,
      fetchedAt: record.sampleFetchedAt,
      apiBaseUrl: record.sampleApiBaseUrl,
    };
  }
  throw new ProjectDataError(
    'PROJECT_DATA358',
    `Unsupported Cast Voice sample source kind: ${record.sampleSourceKind}.`
  );
}

function requiredTrimmed(input: string, fieldName: string): string {
  const value = input?.trim();
  if (!value) {
    throw new ProjectDataError(
      'PROJECT_DATA346',
      `Cast Voice ${fieldName} cannot be empty.`
    );
  }
  return value;
}

function mimeTypeForAudioPath(projectRelativePath: string): string {
  const extension = path.extname(projectRelativePath).toLowerCase();
  const mimeType = AUDIO_EXTENSIONS.get(extension);
  if (!mimeType) {
    throw new ProjectDataError(
      'PROJECT_DATA347',
      `Cast Voice sample file must be mp3, wav, or m4a: ${projectRelativePath}.`
    );
  }
  return mimeType;
}

async function allocateCastVoiceSamplePath(input: {
  projectFolder: string;
  castMemberHandle: string;
  sourceProjectRelativePath: string;
}) {
  const parent = joinProjectRelativePath(
    CAST_ROOT,
    input.castMemberHandle,
    'voice-samples'
  );
  const parsed = path.parse(input.sourceProjectRelativePath);
  const base = parsed.name || 'voice-sample';
  const extension = parsed.ext || '.mp3';
  for (let index = 0; index < 1000; index += 1) {
    const candidate = joinProjectRelativePath(
      parent,
      index === 0 ? `${base}${extension}` : `${base}-${index + 1}${extension}`
    );
    try {
      await fs.access(resolveProjectRelativePath(input.projectFolder, candidate));
    } catch {
      return candidate;
    }
  }
  throw new ProjectDataError(
    'PROJECT_DATA348',
    `Could not allocate a unique Cast Voice sample path for ${input.sourceProjectRelativePath}.`
  );
}

async function statExistingFile(absolutePath: string): Promise<{ size: number }> {
  try {
    const stats = await fs.stat(absolutePath);
    if (!stats.isFile()) {
      throw new Error('not a regular file');
    }
    return { size: stats.size };
  } catch {
    throw new ProjectDataError(
      'PROJECT_DATA349',
      `Cast Voice sample file does not exist: ${absolutePath}.`
    );
  }
}

function assertResolvedPathInsideProject(
  projectFolder: string,
  absolutePath: string
): void {
  const relative = path.relative(projectFolder, absolutePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new ProjectDataError(
      'PROJECT_DATA351',
      `Cast Voice sample file must be inside the project folder: ${absolutePath}.`
    );
  }
}

async function hashFile(absolutePath: string): Promise<string> {
  const buffer = await fs.readFile(absolutePath);
  return hashBuffer(buffer);
}

function hashBuffer(buffer: Buffer): string {
  return `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}`;
}

async function deleteAssetFiles(projectFolder: string, asset: Asset): Promise<void> {
  for (const file of asset.files) {
    const projectRelativePath = normalizeProjectRelativePath(file.projectRelativePath);
    const absolutePath = resolveProjectRelativePath(projectFolder, projectRelativePath);
    assertResolvedPathInsideProject(projectFolder, absolutePath);
    await fs.rm(absolutePath, { force: true });
  }
}

async function withCastVoiceProjectSession<T>(
  input: CastVoiceProjectInput,
  fn: (handle: {
    currentProject: CastVoiceCurrentProject;
    projectFolder: string;
    session: DatabaseSession;
  }) => T | Promise<T>
): Promise<T> {
  if (input.projectName) {
    const handle = await openProjectSession({
      projectName: input.projectName,
      homeDir: input.homeDir,
    });
    try {
      const project = readProjectRecord(handle.session);
      if (!project) {
        throw new ProjectDataError(
          'PROJECT_DATA353',
          `Project database has no project row: ${handle.session.databasePath}.`
        );
      }
      return await fn({
        currentProject: {
          projectName: project.name,
          projectId: project.id,
          projectFolder: handle.projectFolder,
        },
        projectFolder: handle.projectFolder,
        session: handle.session,
      });
    } finally {
      handle.session.close();
    }
  }
  return withCurrentProjectSession(input, ({ currentProject, session }) =>
    fn({
      currentProject,
      projectFolder: currentProject.projectFolder,
      session,
    })
  );
}

interface CastVoiceCurrentProject {
  projectName: string;
  projectId: string;
  projectFolder: string;
}
