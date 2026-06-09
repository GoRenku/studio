import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  Asset,
  CastVoice,
  CastVoiceAttachmentDocument,
  CastVoiceAttachmentReport,
  CastVoiceListReport,
  CastVoiceReadReport,
  CastVoiceRemoveReport,
  CastVoiceValidationReport,
} from '../../client/index.js';
import { insertAssetFileRecord } from '../database/access/asset-files.js';
import { insertAssetRecord } from '../database/access/assets.js';
import {
  deleteAssetRelationshipRecord,
  insertAssetRelationshipRecord,
  nextAssetRelationshipSortOrder,
  readAssetRelationship,
} from '../database/access/asset-relationships/index.js';
import { readCastMemberRecord } from '../database/access/cast-members.js';
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
  document: CastVoiceAttachmentDocument;
  idGenerator?: ProjectIdGenerator;
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
  return withCastVoiceProjectSession(input, async ({ projectFolder, session }) => {
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
  return withCastVoiceProjectSession(input, async ({ projectFolder, session }) => {
    const validated = await validateAttachmentDocument({
      projectFolder,
      session,
      document: input.document,
    });
    const now = new Date().toISOString();
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    const target = {
      kind: 'castMember' as const,
      castMemberId: validated.castMember.id,
    };
    const destinationProjectRelativePath = await allocateCastVoiceSamplePath({
      projectFolder,
      castMemberHandle: validated.castMember.handle,
      sourceProjectRelativePath: validated.sample.sourceProjectRelativePath,
    });
    const sourcePath = resolveProjectRelativePath(
      projectFolder,
      validated.sample.sourceProjectRelativePath
    );
    const destinationPath = resolveProjectRelativePath(
      projectFolder,
      destinationProjectRelativePath
    );
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    if (sourcePath !== destinationPath) {
      await fs.copyFile(sourcePath, destinationPath);
    }
    const contentHash = await hashFile(destinationPath);
    const assetId = ids('asset');
    const assetFileId = ids('asset_file');
    const relationshipId = ids('cast_asset');
    const voiceId = ids('cast_voice');

    session.db.transaction((tx) => {
      const txSession = { ...session, db: tx };
      insertAssetRecord(txSession, {
        id: assetId,
        type: 'cast_voice_sample',
        mediaKind: 'audio',
        title: validated.sample.title,
        origin: validated.sample.receipt ? 'generated' : 'imported',
        availability: 'ready',
        createdAt: now,
        updatedAt: now,
      });
      insertAssetFileRecord(txSession, {
        id: assetFileId,
        assetId,
        role: 'primary',
        projectRelativePath: destinationProjectRelativePath,
        mimeType: validated.mimeType,
        mediaKind: 'audio',
        sizeBytes: validated.sizeBytes,
        contentHash,
        createdAt: now,
        updatedAt: now,
      });
      insertAssetRelationshipRecord(txSession, target, {
        relationshipId,
        assetId,
        localeId: null,
        role: 'voice_sample',
        referenceName: validated.name,
        purpose: validated.purpose,
        sortOrder: nextAssetRelationshipSortOrder(txSession, {
          target,
          role: 'voice_sample',
          localeId: null,
        }),
        now,
      });
      insertCastVoiceRecord(txSession, {
        id: voiceId,
        castMemberId: validated.castMember.id,
        name: validated.name,
        provider: validated.provider,
        model: validated.model,
        voiceId: validated.voiceId,
        purpose: validated.purpose,
        sampleAssetId: assetId,
        sortOrder: nextCastVoiceSortOrder(txSession, validated.castMember.id),
        createdAt: now,
        updatedAt: now,
      });
    });

    const record = requireCastVoiceRecord(session, {
      castMemberId: validated.castMember.id,
      voiceIdOrName: voiceId,
    });
    const voice = toCastVoice(session, record);
    const resourceKeys = studioResourceKeysForAssetTarget(target);
    return {
      valid: true,
      warnings: [],
      castMember: {
        id: validated.castMember.id,
        handle: validated.castMember.handle,
        name: validated.castMember.name,
      },
      voice,
      changes: [
        {
          type: 'castVoice.attached',
          castMemberId: validated.castMember.id,
          voiceId: voice.id,
        },
      ],
      resourceKeys,
    };
  });
}

export async function removeCastVoice(
  input: CastVoiceLookupInput
): Promise<CastVoiceRemoveReport> {
  return withCastVoiceProjectSession(input, async ({ projectFolder, session }) => {
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
    sample: {
      ...sample,
      files: sample.files.filter((file) => file.mediaKind === 'audio'),
    },
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

async function validateAttachmentDocument(input: {
  projectFolder: string;
  session: Parameters<typeof readCastMemberRecord>[0];
  document: CastVoiceAttachmentDocument;
}) {
  const document = input.document;
  if (document.kind !== 'castVoiceAttachment') {
    throw new ProjectDataError(
      'PROJECT_DATA340',
      'Cast Voice attachment kind must be castVoiceAttachment.'
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
  assertReceiptMatchesVoice({
    receipt: document.sample?.receipt,
    provider,
    model,
    voiceId,
  });
  const purpose = requiredTrimmed(document.purpose, 'purpose');
  const sample = document.sample;
  if (!sample) {
    throw new ProjectDataError('PROJECT_DATA344', 'Cast Voice sample is required.');
  }
  const sourceProjectRelativePath = normalizeProjectRelativePath(
    sample.sourceProjectRelativePath
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
    sample: {
      sourceProjectRelativePath,
      title: requiredTrimmed(sample.title, 'sample.title'),
      receipt: sample.receipt,
    },
    mimeType,
    sizeBytes: stats.size,
  };
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
  fn: (handle: { projectFolder: string; session: DatabaseSession }) => T | Promise<T>
): Promise<T> {
  if (input.projectName) {
    const handle = await openProjectSession({
      projectName: input.projectName,
      homeDir: input.homeDir,
    });
    try {
      return await fn({ projectFolder: handle.projectFolder, session: handle.session });
    } finally {
      handle.session.close();
    }
  }
  return withCurrentProjectSession(input, ({ currentProject, session }) =>
    fn({ projectFolder: currentProject.projectFolder, session })
  );
}
