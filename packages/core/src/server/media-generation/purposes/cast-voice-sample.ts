import type {
  CastVoiceProviderCapability,
  CastVoiceProviderRegistration,
  CastVoiceSampleGenerationContext,
  CastVoiceSampleGenerationSpec,
  CastVoiceSampleModelChoice,
  CastVoiceSampleModelListReport,
  MediaGenerationSpecRecord,
  PreparedMediaGeneration,
} from '../../../client/index.js';
import { CAST_VOICE_SAMPLE_GENERATION_PURPOSE } from '../../../client/index.js';
import {
  insertMediaGenerationSpec,
  listMediaGenerationSpecs,
  requireMediaGenerationSpec,
  updateMediaGenerationSpec,
} from '../../database/access/media-generation.js';
import {
  readActiveCastDesignDocument,
  toCastDesignSummary,
} from '../../database/access/department-design.js';
import {
  listCastVoiceProviderRegistrationRecords,
  listCastVoiceRecords,
  type CastVoiceProviderRegistrationRecord,
} from '../../database/access/cast-voices.js';
import {
  listAssetRelationshipPage,
  readAssetRelationship,
} from '../../database/access/asset-relationships/index.js';
import { createRandomIdGenerator, createUniqueIdAllocator, type ProjectIdGenerator } from '../../entity-ids.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { RenkuConfigPathOptions } from '../../renku-config.js';
import { studioResourceKeysForAssetTarget } from '../../studio-coordination/resource-keys.js';
import { draftMediaGenerationSpecRecord } from '../cost/draft-generation.js';
import {
  buildScreenplayContext,
  readCastProjectContext,
  requireCastMemberForContext,
  withCastProjectSession,
} from './cast-image-common.js';

const MODEL_CHOICES = new Set<CastVoiceSampleModelChoice>([
  'elevenlabs/eleven_v3',
  'elevenlabs/eleven_multilingual_v2',
  'elevenlabs/eleven_turbo_v2_5',
]);

export interface CastVoiceSampleTargetInput extends RenkuConfigPathOptions {
  projectName?: string;
  castMemberId: string;
}

export interface CastVoiceSampleSpecInput extends RenkuConfigPathOptions {
  projectName?: string;
  spec: CastVoiceSampleGenerationSpec;
  idGenerator?: ProjectIdGenerator;
}

export interface CastVoiceSampleSpecIdInput extends RenkuConfigPathOptions {
  projectName?: string;
  specId: string;
}

export interface UpdateCastVoiceSampleSpecInput extends CastVoiceSampleSpecIdInput {
  spec: CastVoiceSampleGenerationSpec;
}

export async function buildCastVoiceSampleContext(
  input: CastVoiceSampleTargetInput
): Promise<CastVoiceSampleGenerationContext> {
  const projectContext = await readCastProjectContext(input);
  return withCastProjectSession(input, ({ session }) => {
    const castMember = requireCastMemberForContext(session, input.castMemberId);
    const activeCastDesign = readActiveCastDesignDocument(session, input.castMemberId);
    const target = { kind: 'castMember' as const, castMemberId: input.castMemberId };
    const voiceSampleAssets = listAssetRelationshipPage(session, {
      target,
      role: 'voice_sample',
      mediaKind: 'audio',
      limit: 200,
    }).items;
    return {
      purpose: CAST_VOICE_SAMPLE_GENERATION_PURPOSE,
      target: { kind: 'castMember', id: input.castMemberId },
      project: projectContext,
      screenplay: buildScreenplayContext(session),
      castMember,
      activeCastDesign: activeCastDesign
        ? toCastDesignSummary({
            id: activeCastDesign.id,
            document: activeCastDesign.document,
          })
        : null,
      voices: listCastVoiceRecords(session, input.castMemberId).map((voice) => {
        const sample = readAssetRelationship(session, {
          target,
          assetId: voice.sampleAssetId,
        });
        if (!sample) {
          throw new ProjectDataError(
            'PROJECT_DATA352',
            `Cast Voice sample asset is missing: ${voice.sampleAssetId}.`
          );
        }
        return {
          id: voice.id,
          castMemberId: voice.castMemberId,
          name: voice.name,
          purpose: voice.purpose,
          providerRegistrations: listCastVoiceProviderRegistrationRecords(
            session,
            voice.id
          ).map(toCastVoiceProviderRegistration),
          sampleSource: castVoiceSampleSource(voice),
          sample: {
            ...sample,
            files: sample.files.filter((file) => file.mediaKind === 'audio'),
          },
          createdAt: voice.createdAt,
          updatedAt: voice.updatedAt,
        };
      }),
      voiceSampleAssets,
      defaults: {
        modelChoice: 'elevenlabs/eleven_v3',
        outputFormat: 'mp3_44100_128',
        languageCode: defaultLanguageCode(projectContext.languages),
      },
      resourceKeys: studioResourceKeysForAssetTarget({
        kind: 'castMember',
        castMemberId: input.castMemberId,
      }),
    };
  });
}

function toCastVoiceProviderRegistration(
  record: CastVoiceProviderRegistrationRecord
): CastVoiceProviderRegistration {
  return {
    id: record.id,
    castVoiceId: record.castVoiceId,
    provider: toCastVoiceProvider(record.provider, record.id),
    registrationModel: toCastVoiceProviderRegistrationModel(
      record.registrationModel,
      record.id
    ),
    externalVoiceId: record.externalVoiceId,
    capabilities: parseRegistrationCapabilities(record),
    sourceSampleAssetId: record.sourceSampleAssetId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toCastVoiceProvider(
  provider: string,
  registrationId: string
): CastVoiceProviderRegistration['provider'] {
  if (provider === 'elevenlabs') {
    return provider;
  }
  throw new ProjectDataError(
    'PROJECT_DATA358',
    `Cast Voice provider registration ${registrationId} has unsupported provider: ${provider}.`
  );
}

function toCastVoiceProviderRegistrationModel(
  model: string,
  registrationId: string
): CastVoiceProviderRegistration['registrationModel'] {
  if (
    model === 'eleven_v3' ||
    model === 'eleven_multilingual_v2' ||
    model === 'eleven_turbo_v2_5'
  ) {
    return model;
  }
  throw new ProjectDataError(
    'PROJECT_DATA358',
    `Cast Voice provider registration ${registrationId} has unsupported model: ${model}.`
  );
}

function parseRegistrationCapabilities(
  record: CastVoiceProviderRegistrationRecord
): CastVoiceProviderCapability[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(record.capabilitiesJson);
  } catch {
    throw invalidRegistrationCapabilities(record.id);
  }
  if (!Array.isArray(parsed)) {
    throw invalidRegistrationCapabilities(record.id);
  }
  return Array.from(
    new Set(
      parsed.map((candidate) => {
        if (candidate === 'dialogue-audio-tts') {
          return candidate;
        }
        throw invalidRegistrationCapabilities(record.id);
      })
    )
  );
}

function invalidRegistrationCapabilities(registrationId: string): ProjectDataError {
  return new ProjectDataError(
    'PROJECT_DATA358',
    `Cast Voice provider registration ${registrationId} has invalid capabilities.`
  );
}

function castVoiceSampleSource(voice: ReturnType<typeof listCastVoiceRecords>[number]) {
  if (voice.sampleSourceKind === 'elevenlabs_voice_sample') {
    if (!voice.sampleId || !voice.sampleFetchedAt || !voice.sampleApiBaseUrl) {
      throw new ProjectDataError(
        'PROJECT_DATA357',
        `Cast Voice ${voice.id} is missing ElevenLabs sample provenance.`
      );
    }
    return {
      kind: 'elevenlabs_voice_sample' as const,
      sampleId: voice.sampleId,
      fetchedAt: voice.sampleFetchedAt,
      apiBaseUrl: voice.sampleApiBaseUrl,
    };
  }
  return voice.sampleSourceKind === 'generated_sample'
    ? { kind: 'generated_sample' as const }
    : { kind: 'custom_file' as const };
}

export async function listCastVoiceSampleModels(
  input: CastVoiceSampleTargetInput
): Promise<CastVoiceSampleModelListReport> {
  await buildCastVoiceSampleContext(input);
  return {
    purpose: CAST_VOICE_SAMPLE_GENERATION_PURPOSE,
    target: { kind: 'castMember', id: input.castMemberId },
    models: [
      modelReport('elevenlabs/eleven_v3', 'Eleven v3'),
      modelReport('elevenlabs/eleven_multilingual_v2', 'Eleven Multilingual v2'),
      modelReport('elevenlabs/eleven_turbo_v2_5', 'Eleven Turbo v2.5'),
    ],
  };
}

export async function validateCastVoiceSampleSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: CastVoiceSampleGenerationSpec;
}): Promise<{ valid: true; spec: CastVoiceSampleGenerationSpec; providerPayload: Record<string, unknown> }> {
  const normalized = normalizeSpec(input.spec);
  await buildCastVoiceSampleContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    castMemberId: normalized.target.id,
  });
  return {
    valid: true,
    spec: normalized,
    providerPayload: buildProviderPayload(normalized),
  };
}

export async function createCastVoiceSampleSpec(
  input: CastVoiceSampleSpecInput
): Promise<MediaGenerationSpecRecord> {
  const normalized = normalizeSpec(input.spec);
  await validateCastVoiceSampleSpec({ ...input, spec: normalized });
  return withCastProjectSession(input, ({ session }) => {
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    return insertMediaGenerationSpec(session, {
      id: ids('media_generation_spec'),
      spec: normalized,
      title: titleForSpec(normalized),
      now: new Date().toISOString(),
    });
  });
}

export async function updateCastVoiceSampleSpec(
  input: UpdateCastVoiceSampleSpecInput
): Promise<MediaGenerationSpecRecord> {
  const normalized = normalizeSpec(input.spec);
  await validateCastVoiceSampleSpec({ ...input, spec: normalized });
  return withCastProjectSession(input, ({ session }) =>
    updateMediaGenerationSpec(session, {
      id: input.specId,
      spec: normalized,
      title: titleForSpec(normalized),
      now: new Date().toISOString(),
    })
  );
}

export async function listCastVoiceSampleSpecs(
  input: CastVoiceSampleTargetInput
): Promise<{ specs: MediaGenerationSpecRecord[] }> {
  return withCastProjectSession(input, ({ session }) => ({
    specs: listMediaGenerationSpecs(session, {
      purpose: CAST_VOICE_SAMPLE_GENERATION_PURPOSE,
      targetKind: 'castMember',
      targetId: input.castMemberId,
    }),
  }));
}

export async function prepareCastVoiceSampleSpec(
  input: CastVoiceSampleSpecIdInput
): Promise<PreparedMediaGeneration> {
  const specRecord = await withCastProjectSession(input, ({ session }) =>
    requireMediaGenerationSpec(session, input.specId)
  );
  assertCastVoiceSampleSpec(specRecord.spec);
  return prepared(specRecord);
}

export async function prepareCastVoiceSampleDraftSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: CastVoiceSampleGenerationSpec;
}): Promise<PreparedMediaGeneration> {
  const normalized = normalizeSpec(input.spec);
  return prepared(draftMediaGenerationSpecRecord(normalized));
}

export async function runCastVoiceSampleSpec(): Promise<never> {
  throw new ProjectDataError(
    'PROJECT_DATA356',
    'Cast Voice sample generation runs through the shared media generation runner.'
  );
}

function prepared(specRecord: MediaGenerationSpecRecord): PreparedMediaGeneration {
  assertCastVoiceSampleSpec(specRecord.spec);
  const providerPayload = buildProviderPayload(specRecord.spec);
  return {
    spec: specRecord,
    providerPayload,
    generation: {
      policy: {
        provider: 'elevenlabs',
        model: parseModel(specRecord.spec.modelChoice),
        mediaKind: 'audio',
        mode: 'text-to-speech',
        outputCount: 1,
      },
      request: {
        parameters: providerPayload,
        outputNames: [outputName(specRecord.spec)],
      },
    },
  };
}

function normalizeSpec(
  spec: CastVoiceSampleGenerationSpec
): CastVoiceSampleGenerationSpec {
  if (spec.purpose !== CAST_VOICE_SAMPLE_GENERATION_PURPOSE) {
    throw new ProjectDataError(
      'PROJECT_DATA354',
      `Cast Voice sample spec purpose must be ${CAST_VOICE_SAMPLE_GENERATION_PURPOSE}.`
    );
  }
  if (spec.target.kind !== 'castMember') {
    throw new ProjectDataError(
      'PROJECT_DATA354',
      `Cast Voice sample target.kind must be castMember. Received: ${spec.target.kind}.`
    );
  }
  if (!MODEL_CHOICES.has(spec.modelChoice)) {
    throw new ProjectDataError(
      'PROJECT_DATA343',
      `Unsupported Cast Voice sample model: ${spec.modelChoice}.`
    );
  }
  return {
    ...spec,
    voiceId: requiredTrimmed(spec.voiceId, 'voiceId'),
    text: requiredTrimmed(spec.text, 'text'),
    referenceName: requiredReferenceName(spec.referenceName),
    referencePurpose: requiredTrimmed(spec.referencePurpose, 'referencePurpose'),
    outputFormat: spec.outputFormat?.trim() || 'mp3_44100_128',
    languageCode: spec.languageCode?.trim() || null,
    title: spec.title?.trim() || undefined,
  };
}

function buildProviderPayload(spec: CastVoiceSampleGenerationSpec): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    text: spec.text,
    voice: spec.voiceId,
  };
  if (spec.outputFormat) {
    payload.output_format = spec.outputFormat;
  }
  if (spec.languageCode) {
    payload.language_code = spec.languageCode;
  }
  if (spec.voiceSettings) {
    payload.voice_settings = {
      ...(spec.voiceSettings.stability !== undefined
        ? { stability: spec.voiceSettings.stability }
        : {}),
      ...(spec.voiceSettings.similarityBoost !== undefined
        ? { similarity_boost: spec.voiceSettings.similarityBoost }
        : {}),
      ...(spec.voiceSettings.style !== undefined
        ? { style: spec.voiceSettings.style }
        : {}),
      ...(spec.voiceSettings.speed !== undefined
        ? { speed: spec.voiceSettings.speed }
        : {}),
      ...(spec.voiceSettings.useSpeakerBoost !== undefined
        ? { use_speaker_boost: spec.voiceSettings.useSpeakerBoost }
        : {}),
    };
  }
  return payload;
}

function modelReport(modelChoice: CastVoiceSampleModelChoice, label: string) {
  return {
    modelChoice,
    label,
    available: true as const,
    provider: 'elevenlabs' as const,
    model: parseModel(modelChoice),
    mediaKind: 'audio' as const,
    mode: 'text-to-speech' as const,
  };
}

function parseModel(
  modelChoice: CastVoiceSampleModelChoice
): 'eleven_v3' | 'eleven_multilingual_v2' | 'eleven_turbo_v2_5' {
  if (modelChoice === 'elevenlabs/eleven_v3') {
    return 'eleven_v3';
  }
  if (modelChoice === 'elevenlabs/eleven_multilingual_v2') {
    return 'eleven_multilingual_v2';
  }
  return 'eleven_turbo_v2_5';
}

function assertCastVoiceSampleSpec(
  spec: unknown
): asserts spec is CastVoiceSampleGenerationSpec {
  if (
    !spec ||
    typeof spec !== 'object' ||
    (spec as { purpose?: unknown }).purpose !== CAST_VOICE_SAMPLE_GENERATION_PURPOSE
  ) {
    throw new ProjectDataError(
      'PROJECT_DATA355',
      'Media Generation Spec is not a Cast Voice sample spec.'
    );
  }
}

function requiredReferenceName(input: string): string {
  const value = requiredTrimmed(input, 'referenceName');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new ProjectDataError(
      'PROJECT_DATA345',
      `Cast Voice reference name must use lower-case letters, numbers, and single hyphen separators: ${value}.`
    );
  }
  return value;
}

function requiredTrimmed(input: string, fieldName: string): string {
  const value = input?.trim();
  if (!value) {
    throw new ProjectDataError(
      'PROJECT_DATA346',
      `Cast Voice sample ${fieldName} cannot be empty.`
    );
  }
  return value;
}

function defaultLanguageCode(
  languages: CastVoiceSampleGenerationContext['project']['languages']
): string | null {
  const base = languages.find((language) => language.isBase);
  return base?.localeTag.split('-')[0]?.toLowerCase() ?? null;
}

function titleForSpec(spec: CastVoiceSampleGenerationSpec): string {
  return spec.title ?? humanizeReferenceName(spec.referenceName);
}

function outputName(spec: CastVoiceSampleGenerationSpec): string {
  const base = spec.referenceName || 'voice-sample';
  return `${base}.${extensionForOutputFormat(spec.outputFormat ?? 'mp3_44100_128')}`;
}

function extensionForOutputFormat(outputFormat: string): string {
  if (outputFormat.startsWith('pcm_')) {
    return 'wav';
  }
  if (outputFormat.startsWith('mp3_')) {
    return 'mp3';
  }
  return 'mp3';
}

function humanizeReferenceName(name: string): string {
  return name
    .split('-')
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
