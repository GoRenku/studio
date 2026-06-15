import fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import type {
  MediaGenerationDependencyPricing,
  MediaGenerationEstimateReport,
  MediaGenerationSpecRecord,
  PreparedMediaGeneration,
  SceneDialogueAudioContext,
  SceneDialogueAudioGenerationSpec,
  SceneDialogueAudioModelChoice,
  SceneDialogueAudioModelListReport,
  SceneDialogueAudioMutationReport,
  SceneDialogueAudioTextTreatment,
  SceneDialogueAudioVoiceSettings,
} from '../../client/index.js';
import type { GenerationEstimate } from '@gorenku/studio-engines';
import {
  createDiagnosticWarning,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import { SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE } from '../../client/index.js';
import { insertAssetFileRecord } from '../database/access/asset-files.js';
import {
  assetRelationshipIdPrefix,
  insertAssetRelationshipRecord,
  nextAssetRelationshipSortOrder,
} from '../database/access/asset-relationships/index.js';
import { insertAssetRecord } from '../database/access/assets.js';
import {
  listCastVoiceProviderRegistrationRecords,
  listCastVoiceRecords,
  type CastVoiceProviderRegistrationRecord,
  type CastVoiceRecord,
} from '../database/access/cast-voices.js';
import { listProjectLocaleRecords } from '../database/access/project-locales.js';
import {
  insertMediaGenerationSpec,
  listMediaGenerationSpecs,
  requireMediaGenerationSpec,
  updateMediaGenerationSpec,
} from '../database/access/media-generation.js';
import { readProjectRecord } from '../database/access/project.js';
import {
  deleteSceneDialogueAudioTakeRecord,
  insertSceneDialogueAudioTakeRecord,
  listSceneDialogueAudioRecords,
  listSceneDialogueAudioTakeRecords,
  pickSceneDialogueAudioTakeRecord,
  readSceneDialogueAudioRecord,
  toSceneDialogueAudio,
  upsertSceneDialogueAudioRecord,
} from '../database/access/scene-dialogue-audio.js';
import { readScreenplaySceneFromSession } from '../database/access/screenplay-resource.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
  type ProjectIdGenerator,
} from '../entity-ids.js';
import type { ProjectRelativePath } from '../../client/project.js';
import { ProjectDataError } from '../project-data-error.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';
import { draftMediaGenerationSpecRecord } from './draft-generation.js';
import type {
  MediaGenerationDependencyDraftPlan,
  MediaGenerationDependencyDraftSpecInput,
} from './dependency-draft-specs.js';
import {
  estimateDraftMediaGenerationSpec,
  runMediaGenerationSpec,
} from './shared-generation-service.js';

const MODEL_CHOICES = new Set<SceneDialogueAudioModelChoice>([
  'elevenlabs/eleven_v3',
  'elevenlabs/eleven_multilingual_v2',
  'elevenlabs/eleven_turbo_v2_5',
]);

const DEFAULT_MODEL_CHOICE: SceneDialogueAudioModelChoice =
  'elevenlabs/eleven_v3';
const DEFAULT_OUTPUT_FORMAT = 'mp3_44100_128';
const MISSING_CAST_VOICE_REASON =
  'Assign a Cast Voice before generating dialogue audio.';
const DEFAULT_VOICE_SETTINGS: SceneDialogueAudioVoiceSettings = {
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0,
  speed: 1,
  useSpeakerBoost: true,
};

export interface SceneDialogueAudioTargetInput extends RenkuConfigPathOptions {
  projectName?: string;
  sceneId: string;
  dialogueId?: string;
}

export interface SceneDialogueAudioSpecInput extends RenkuConfigPathOptions {
  projectName?: string;
  spec: SceneDialogueAudioGenerationSpec;
  idGenerator?: ProjectIdGenerator;
}

export interface SceneDialogueAudioSpecIdInput extends RenkuConfigPathOptions {
  projectName?: string;
  specId: string;
}

export interface UpdateSceneDialogueAudioSpecInput extends SceneDialogueAudioSpecIdInput {
  spec: SceneDialogueAudioGenerationSpec;
}

export interface GenerateSceneDialogueAudioTakeInput extends RenkuConfigPathOptions {
  projectName?: string;
  sceneId: string;
  dialogueId: string;
  setup: Partial<SceneDialogueAudioGenerationSpec>;
  approvalToken?: string;
  simulate?: boolean;
  allowUnpricedCost?: boolean;
  idGenerator?: ProjectIdGenerator;
}

export interface UpdateSceneDialogueAudioSetupInput extends RenkuConfigPathOptions {
  projectName?: string;
  sceneId: string;
  dialogueId: string;
  setup: Partial<SceneDialogueAudioGenerationSpec>;
  idGenerator?: ProjectIdGenerator;
}

export interface PickSceneDialogueAudioTakeInput extends RenkuConfigPathOptions {
  projectName?: string;
  sceneId: string;
  dialogueId: string;
  takeId: string;
}

export interface DeleteSceneDialogueAudioTakeInput extends PickSceneDialogueAudioTakeInput {}

interface NormalizedSceneDialogueAudioSpec {
  spec: SceneDialogueAudioGenerationSpec;
  castMemberId: string;
  castVoice: {
    id: string;
    name: string;
    externalVoiceId: string;
  };
  voiceSettings: SceneDialogueAudioVoiceSettings;
  providerText: string;
  textTreatment: SceneDialogueAudioTextTreatment;
}

export async function readSceneDialogueAudioContext(
  input: SceneDialogueAudioTargetInput,
): Promise<SceneDialogueAudioContext> {
  return withSceneDialogueAudioProjectSession(input, ({ session }) =>
    buildContextFromSession(session, input.sceneId),
  );
}

export async function listSceneDialogueAudioModels(
  input: SceneDialogueAudioTargetInput,
): Promise<SceneDialogueAudioModelListReport> {
  return {
    purpose: SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE,
    target: {
      kind: 'sceneDialogue',
      sceneId: input.sceneId,
      dialogueId: input.dialogueId ?? '',
    },
    models: modelReports(),
  };
}

export async function validateSceneDialogueAudioSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: SceneDialogueAudioGenerationSpec;
}): Promise<{
  valid: true;
  spec: SceneDialogueAudioGenerationSpec;
  providerPayload: Record<string, unknown>;
}> {
  const normalized = await normalizeSpec(input);
  return {
    valid: true,
    spec: normalized.spec,
    providerPayload: buildProviderPayload(normalized),
  };
}

export async function createSceneDialogueAudioSpec(
  input: SceneDialogueAudioSpecInput,
): Promise<MediaGenerationSpecRecord> {
  const normalized = await normalizeSpec(input);
  return withSceneDialogueAudioProjectSession(input, ({ session }) => {
    const ids = createUniqueIdAllocator(
      input.idGenerator ?? createRandomIdGenerator(),
    );
    return insertMediaGenerationSpec(session, {
      id: ids('media_generation_spec'),
      spec: normalized.spec,
      title: titleForSpec(normalized.spec),
      now: new Date().toISOString(),
    });
  });
}

export async function updateSceneDialogueAudioSpec(
  input: UpdateSceneDialogueAudioSpecInput,
): Promise<MediaGenerationSpecRecord> {
  const normalized = await normalizeSpec(input);
  return withSceneDialogueAudioProjectSession(input, ({ session }) =>
    updateMediaGenerationSpec(session, {
      id: input.specId,
      spec: normalized.spec,
      title: titleForSpec(normalized.spec),
      now: new Date().toISOString(),
    }),
  );
}

export async function listSceneDialogueAudioSpecs(
  input: SceneDialogueAudioTargetInput,
): Promise<{ specs: MediaGenerationSpecRecord[] }> {
  return withSceneDialogueAudioProjectSession(input, ({ session }) => ({
    specs: listMediaGenerationSpecs(session, {
      purpose: SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE,
      targetKind: 'sceneDialogue',
      targetId: `${input.sceneId}:${input.dialogueId ?? ''}`,
    }),
  }));
}

export async function prepareSceneDialogueAudioSpec(
  input: SceneDialogueAudioSpecIdInput,
): Promise<PreparedMediaGeneration> {
  const specRecord = await withSceneDialogueAudioProjectSession(
    input,
    ({ session }) => requireMediaGenerationSpec(session, input.specId),
  );
  assertSceneDialogueAudioSpec(specRecord.spec);
  const normalized = await normalizeSpec({ ...input, spec: specRecord.spec });
  return prepared(specRecord, normalized);
}

export async function prepareSceneDialogueAudioDraftSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: SceneDialogueAudioGenerationSpec;
}): Promise<PreparedMediaGeneration> {
  const normalized = await normalizeSpec(input);
  return prepared(draftMediaGenerationSpecRecord(normalized.spec), normalized);
}

export async function estimateSceneDialogueAudioDraft(
  input: SceneDialogueAudioSpecInput,
): Promise<MediaGenerationEstimateReport> {
  return estimateDraftMediaGenerationSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec,
  });
}

export async function buildSceneDialogueAudioDependencyDraftSpec(
  input: MediaGenerationDependencyDraftSpecInput,
): Promise<MediaGenerationDependencyDraftPlan> {
  if (input.dependencyTarget.kind !== 'sceneDialogue') {
    throw new ProjectDataError(
      'CORE_MEDIA_DEPENDENCY_INVALID_DRAFT_SPEC',
      `Scene Dialogue Audio dependency requires a sceneDialogue target. Received: ${input.dependencyTarget.kind}.`,
    );
  }
  const hasUsableVoice = await sceneDialogueHasUsableVoice({
    projectName: input.projectName,
    homeDir: input.homeDir,
    sceneId: input.dependencyTarget.sceneId,
    dialogueId: input.dependencyTarget.dialogueId,
  });
  if (!hasUsableVoice) {
    const priced = await estimateSceneDialogueAudioPricingOnly({
      projectName: input.projectName,
      homeDir: input.homeDir,
      sceneId: input.dependencyTarget.sceneId,
      dialogueId: input.dependencyTarget.dialogueId,
      setup: { title: input.label },
    });
    return {
      materializationState: 'missing-input',
      materializationReason: MISSING_CAST_VOICE_REASON,
      pricing: priced.pricing,
      estimate: priced.estimate,
      diagnostics: priced.diagnostics,
    };
  }
  const spec = await specForDialogueInput({
    projectName: input.projectName,
    homeDir: input.homeDir,
    sceneId: input.dependencyTarget.sceneId,
    dialogueId: input.dependencyTarget.dialogueId,
    setup: { title: input.label },
  });
  return {
    purpose: SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE,
    spec,
    materializationState: 'generatable',
  };
}

export async function estimateSceneDialogueAudioPricingOnly(input: {
  projectName?: string;
  homeDir?: string;
  sceneId: string;
  dialogueId: string;
  setup: Partial<SceneDialogueAudioGenerationSpec>;
}): Promise<{
  pricing: MediaGenerationDependencyPricing;
  estimate: GenerationEstimate | null;
  diagnostics: DiagnosticIssue[];
}> {
  try {
    const pricingInput = await sceneDialogueAudioPricingInput(input);
    const { estimateGeneration } = await import('@gorenku/studio-engines');
    const estimate = await estimateGeneration({
      policy: {
        provider: 'elevenlabs' as const,
        model: parseModel(pricingInput.modelChoice),
        mediaKind: 'audio',
        mode: 'text-to-speech',
        outputCount: 1,
      },
      request: {
        parameters: {
          text: pricingInput.providerText,
          output_format: pricingInput.outputFormat,
          ...(pricingInput.languageCode
            ? { language_code: pricingInput.languageCode }
            : {}),
        },
        pricingInputCounts: {},
        outputNames: [pricingInput.outputName],
      },
    });
    if (estimate.estimatedCostUsd === null) {
      return {
        pricing: {
          state: 'unpriced',
          estimatedUsd: null,
          reason:
            estimate.warnings.join(' ') ||
            'No pricing is configured for this dialogue audio model.',
          overrideRequired: true,
        },
        estimate,
        diagnostics: [
          createDiagnosticWarning(
            'CORE_SCENE_DIALOGUE_AUDIO_MISSING_CAST_VOICE',
            MISSING_CAST_VOICE_REASON,
            { path: ['sceneDialogueAudio', input.dialogueId, 'castVoiceId'] },
            MISSING_CAST_VOICE_REASON
          ),
        ],
      };
    }
    return {
      pricing: { state: 'priced', estimatedUsd: estimate.estimatedCostUsd },
      estimate,
      diagnostics: [
        createDiagnosticWarning(
          'CORE_SCENE_DIALOGUE_AUDIO_MISSING_CAST_VOICE',
          MISSING_CAST_VOICE_REASON,
          { path: ['sceneDialogueAudio', input.dialogueId, 'castVoiceId'] },
          MISSING_CAST_VOICE_REASON
        ),
      ],
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Dialogue audio estimate failed.';
    return {
      pricing: {
        state: 'unpriced',
        estimatedUsd: null,
        reason: message,
        overrideRequired: true,
      },
      estimate: null,
      diagnostics: [
        createDiagnosticWarning(
          'CORE_SCENE_DIALOGUE_AUDIO_MISSING_CAST_VOICE',
          MISSING_CAST_VOICE_REASON,
          { path: ['sceneDialogueAudio', input.dialogueId, 'castVoiceId'] },
          MISSING_CAST_VOICE_REASON
        ),
      ],
    };
  }
}

export async function updateSceneDialogueAudioSetup(
  input: UpdateSceneDialogueAudioSetupInput,
): Promise<SceneDialogueAudioMutationReport> {
  await withSceneDialogueAudioProjectSession(input, ({ session }) => {
    const dialogue = requireDialogue(session, input.sceneId, input.dialogueId);
    if (!dialogue.castMemberId) {
      throw new ProjectDataError(
        'PROJECT_DATA386',
        'Dialogue has no Cast Member.',
        {
          suggestion:
            'Assign a Cast Member to the dialogue before saving audio setup.',
        },
      );
    }
    const existing = readSceneDialogueAudioRecord(session, {
      sceneId: input.sceneId,
      dialogueId: input.dialogueId,
    });
    const ids = createUniqueIdAllocator(
      input.idGenerator ?? createRandomIdGenerator(),
    );
    const plainText =
      input.setup.plainText ?? existing?.plainText ?? dialogue.lines.join('\n');
    const castVoiceId = normalizeOptionalCastVoiceId(session, {
      castMemberId: dialogue.castMemberId,
      castVoiceId: input.setup.castVoiceId ?? existing?.castVoiceId ?? null,
    });
    upsertSceneDialogueAudioRecord(session, {
      id: ids('scene_dialogue_audio'),
      sceneId: input.sceneId,
      dialogueId: input.dialogueId,
      castMemberId: dialogue.castMemberId,
      castVoiceId,
      modelChoice:
        input.setup.modelChoice ??
        (existing?.modelChoice as SceneDialogueAudioModelChoice | undefined) ??
        DEFAULT_MODEL_CHOICE,
      plainText,
      v3Text: input.setup.v3Text ?? existing?.v3Text ?? plainText,
      voiceSettings: normalizeVoiceSettings(
        input.setup.voiceSettings ??
          parseVoiceSettings(existing?.voiceSettingsJson),
      ),
      outputFormat:
        input.setup.outputFormat ??
        existing?.outputFormat ??
        DEFAULT_OUTPUT_FORMAT,
      languageCode: input.setup.languageCode ?? existing?.languageCode ?? null,
      now: new Date().toISOString(),
    });
  });
  return mutationReport(input);
}

export async function generateSceneDialogueAudioTake(
  input: GenerateSceneDialogueAudioTakeInput,
): Promise<SceneDialogueAudioMutationReport> {
  const draft = await specForDialogueInput(input);
  const normalized = await normalizeSpec({ ...input, spec: draft });
  const specRecord = await upsertGenerationSpec(input, normalized.spec);
  const runReport = await runMediaGenerationSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    specId: specRecord.id,
    approvalToken: input.approvalToken,
    simulate: input.simulate,
    allowUnpricedCost: input.allowUnpricedCost,
    idGenerator: input.idGenerator,
  });
  const output = firstAudioOutput(runReport.run.outputs);
  const now = new Date().toISOString();
  await withSceneDialogueAudioProjectSession(
    input,
    async ({ projectFolder, session }) => {
      const ids = createUniqueIdAllocator(
        input.idGenerator ?? createRandomIdGenerator(),
      );
      const takeId = ids('scene_dialogue_audio_take');
      const persistedAudioPath = await persistDialogueAudioTakeFile({
        projectFolder,
        sourceProjectRelativePath: output.projectRelativePath,
        dialogueId: input.dialogueId,
        takeId,
        outputFormat: normalized.spec.outputFormat,
      });
      const fileStats = await fs.stat(
        path.join(projectFolder, persistedAudioPath),
      );
      const audioRecord = upsertSceneDialogueAudioRecord(session, {
        id: ids('scene_dialogue_audio'),
        sceneId: input.sceneId,
        dialogueId: input.dialogueId,
        castMemberId: normalized.castMemberId,
        castVoiceId: normalized.castVoice.id,
        modelChoice: normalized.spec.modelChoice,
        plainText: normalized.spec.plainText,
        v3Text: normalized.spec.v3Text,
        voiceSettings: normalized.voiceSettings,
        outputFormat: normalized.spec.outputFormat ?? DEFAULT_OUTPUT_FORMAT,
        languageCode: normalized.spec.languageCode ?? null,
        now,
      });
      const assetId = ids('asset');
      const assetFileId = ids('asset_file');
      const target = { kind: 'scene' as const, sceneId: input.sceneId };
      insertAssetRecord(session, {
        id: assetId,
        type: 'audio',
        mediaKind: 'audio',
        title: 'Dialogue audio take',
        origin: 'generated',
        availability: 'ready',
        createdAt: now,
        updatedAt: now,
      });
      insertAssetFileRecord(session, {
        id: assetFileId,
        assetId,
        role: 'audio',
        projectRelativePath: persistedAudioPath,
        mimeType:
          output.mimeType ??
          mimeTypeForOutputFormat(normalized.spec.outputFormat),
        mediaKind: 'audio',
        sizeBytes: fileStats.size,
        createdAt: now,
        updatedAt: now,
      });
      insertAssetRelationshipRecord(session, target, {
        relationshipId: ids(assetRelationshipIdPrefix(target)),
        assetId,
        localeId: null,
        role: 'dialogue_audio',
        referenceName: null,
        purpose: null,
        sortOrder: nextAssetRelationshipSortOrder(session, {
          target,
          role: 'dialogue_audio',
          localeId: null,
        }),
        now,
      });
      const take = insertSceneDialogueAudioTakeRecord(session, {
        id: takeId,
        sceneDialogueAudioId: audioRecord.id,
        assetId,
        assetFileId,
        mediaGenerationRunId: runReport.run.id,
        modelChoice: normalized.spec.modelChoice,
        castVoiceId: normalized.castVoice.id,
        castVoiceName: normalized.castVoice.name,
        provider: 'elevenlabs',
        providerVoiceId: normalized.castVoice.externalVoiceId.trim(),
        providerTextSnapshot: normalized.providerText,
        plainTextSnapshot: normalized.spec.plainText,
        v3TextSnapshot: normalized.spec.v3Text,
        textTreatment: normalized.textTreatment,
        voiceSettingsSnapshot: normalized.voiceSettings,
        outputFormat: normalized.spec.outputFormat ?? DEFAULT_OUTPUT_FORMAT,
        languageCode: normalized.spec.languageCode ?? null,
        now,
      });
      pickSceneDialogueAudioTakeRecord(session, {
        sceneDialogueAudioId: audioRecord.id,
        takeId: take.id,
        updatedAt: now,
      });
    },
  );
  return mutationReport(input);
}

export async function pickSceneDialogueAudioTake(
  input: PickSceneDialogueAudioTakeInput,
): Promise<SceneDialogueAudioMutationReport> {
  await withSceneDialogueAudioProjectSession(input, ({ session }) => {
    const audio = requireAudioForDialogue(
      session,
      input.sceneId,
      input.dialogueId,
    );
    pickSceneDialogueAudioTakeRecord(session, {
      sceneDialogueAudioId: audio.id,
      takeId: input.takeId,
      updatedAt: new Date().toISOString(),
    });
  });
  return mutationReport(input);
}

export async function deleteSceneDialogueAudioTake(
  input: DeleteSceneDialogueAudioTakeInput,
): Promise<SceneDialogueAudioMutationReport> {
  await withSceneDialogueAudioProjectSession(input, ({ session }) => {
    const audio = requireAudioForDialogue(
      session,
      input.sceneId,
      input.dialogueId,
    );
    deleteSceneDialogueAudioTakeRecord(session, {
      sceneDialogueAudioId: audio.id,
      takeId: input.takeId,
      updatedAt: new Date().toISOString(),
    });
  });
  return mutationReport(input);
}

export async function runSceneDialogueAudioSpec(): Promise<never> {
  throw new ProjectDataError(
    'PROJECT_DATA383',
    'Scene Dialogue Audio generation runs through generateSceneDialogueAudioTake.',
  );
}

async function specForDialogueInput(
  input: GenerateSceneDialogueAudioTakeInput,
): Promise<SceneDialogueAudioGenerationSpec> {
  return withSceneDialogueAudioProjectSession(input, ({ session }) => {
    const existing = readSceneDialogueAudioRecord(session, {
      sceneId: input.sceneId,
      dialogueId: input.dialogueId,
    });
    const dialogue = requireDialogue(session, input.sceneId, input.dialogueId);
    const plainText = dialogue.lines.join('\n');
    return {
      purpose: SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE,
      target: {
        kind: 'sceneDialogue',
        sceneId: input.sceneId,
        dialogueId: input.dialogueId,
      },
      modelChoice:
        input.setup.modelChoice ??
        (existing?.modelChoice as SceneDialogueAudioModelChoice | undefined) ??
        DEFAULT_MODEL_CHOICE,
      castVoiceId:
        input.setup.castVoiceId ??
        existing?.castVoiceId ??
        defaultCastVoiceId(session, dialogue.castMemberId),
      plainText: input.setup.plainText ?? existing?.plainText ?? plainText,
      v3Text: input.setup.v3Text ?? existing?.v3Text ?? plainText,
      voiceSettings:
        input.setup.voiceSettings ??
        parseVoiceSettings(existing?.voiceSettingsJson),
      outputFormat:
        input.setup.outputFormat ??
        existing?.outputFormat ??
        DEFAULT_OUTPUT_FORMAT,
      languageCode: input.setup.languageCode ?? existing?.languageCode ?? null,
      title: input.setup.title,
    };
  });
}

async function sceneDialogueHasUsableVoice(input: {
  projectName?: string;
  homeDir?: string;
  sceneId: string;
  dialogueId: string;
}): Promise<boolean> {
  return withSceneDialogueAudioProjectSession(input, ({ session }) => {
    const dialogue = requireDialogue(session, input.sceneId, input.dialogueId);
    if (!dialogue.castMemberId) {
      return false;
    }
    const existing = readSceneDialogueAudioRecord(session, {
      sceneId: input.sceneId,
      dialogueId: input.dialogueId,
    });
    if (existing?.castVoiceId) {
      const selectedVoice = listCastVoiceRecords(session, dialogue.castMemberId).find(
        (voice) => voice.id === existing.castVoiceId
      );
      return Boolean(selectedVoice && dialogueTtsRegistration(session, selectedVoice));
    }
    return listCastVoiceRecords(session, dialogue.castMemberId).some(
      (voice) => Boolean(dialogueTtsRegistration(session, voice))
    );
  });
}

async function sceneDialogueAudioPricingInput(input: {
  projectName?: string;
  homeDir?: string;
  sceneId: string;
  dialogueId: string;
  setup: Partial<SceneDialogueAudioGenerationSpec>;
}): Promise<{
  modelChoice: SceneDialogueAudioModelChoice;
  providerText: string;
  outputFormat: string;
  languageCode: string | null;
  outputName: string;
}> {
  return withSceneDialogueAudioProjectSession(input, ({ session }) => {
    const existing = readSceneDialogueAudioRecord(session, {
      sceneId: input.sceneId,
      dialogueId: input.dialogueId,
    });
    const dialogue = requireDialogue(session, input.sceneId, input.dialogueId);
    const plainText =
      input.setup.plainText ?? existing?.plainText ?? dialogue.lines.join('\n');
    const modelChoice =
      input.setup.modelChoice ??
      (existing?.modelChoice as SceneDialogueAudioModelChoice | undefined) ??
      DEFAULT_MODEL_CHOICE;
    if (!MODEL_CHOICES.has(modelChoice)) {
      throw new ProjectDataError(
        'PROJECT_DATA385',
        `Unsupported Scene Dialogue Audio model: ${modelChoice}.`,
      );
    }
    const normalizedPlainText = requiredTrimmed(plainText, 'plainText');
    const rawV3Text = input.setup.v3Text ?? existing?.v3Text ?? plainText;
    const normalizedV3Text =
      modelChoice === 'elevenlabs/eleven_v3'
        ? requiredTrimmed(rawV3Text, 'v3Text')
        : rawV3Text.trim();
    const textTreatment = textTreatmentForModel(modelChoice);
    const providerText =
      textTreatment === 'elevenlabs-v3-audio-tags'
        ? normalizedV3Text
        : normalizedPlainText;
    return {
      modelChoice,
      providerText,
      outputFormat:
        input.setup.outputFormat ??
        existing?.outputFormat ??
        DEFAULT_OUTPUT_FORMAT,
      languageCode: input.setup.languageCode ?? existing?.languageCode ?? null,
      outputName: `${input.setup.title?.trim() || 'dialogue-audio'}.mp3`,
    };
  });
}

async function upsertGenerationSpec(
  input: GenerateSceneDialogueAudioTakeInput,
  spec: SceneDialogueAudioGenerationSpec,
): Promise<MediaGenerationSpecRecord> {
  const existing = await listSceneDialogueAudioSpecs({
    projectName: input.projectName,
    homeDir: input.homeDir,
    sceneId: input.sceneId,
    dialogueId: input.dialogueId,
  });
  const current = existing.specs[0];
  return current
    ? updateSceneDialogueAudioSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        specId: current.id,
        spec,
      })
    : createSceneDialogueAudioSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec,
        idGenerator: input.idGenerator,
      });
}

async function normalizeSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: SceneDialogueAudioGenerationSpec;
}): Promise<NormalizedSceneDialogueAudioSpec> {
  if (input.spec.purpose !== SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE) {
    throw new ProjectDataError(
      'PROJECT_DATA384',
      `Scene Dialogue Audio spec purpose must be ${SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE}.`,
    );
  }
  if (input.spec.target.kind !== 'sceneDialogue') {
    throw new ProjectDataError(
      'PROJECT_DATA384',
      `Scene Dialogue Audio target.kind must be sceneDialogue. Received: ${input.spec.target.kind}.`,
    );
  }
  if (!MODEL_CHOICES.has(input.spec.modelChoice)) {
    throw new ProjectDataError(
      'PROJECT_DATA385',
      `Unsupported Scene Dialogue Audio model: ${input.spec.modelChoice}.`,
    );
  }
  return withSceneDialogueAudioProjectSession(input, ({ session }) => {
    const dialogue = requireDialogue(
      session,
      input.spec.target.sceneId,
      input.spec.target.dialogueId,
    );
    if (!dialogue.castMemberId) {
      throw new ProjectDataError(
        'PROJECT_DATA386',
        `Dialogue has no Cast Member: ${input.spec.target.dialogueId}.`,
        {
          suggestion:
            'Assign a Cast Member to the dialogue before generating audio.',
        },
      );
    }
    const castVoice = listCastVoiceRecords(session, dialogue.castMemberId).find(
      (voice) => voice.id === input.spec.castVoiceId,
    );
    const providerRegistration = castVoice
      ? dialogueTtsRegistration(session, castVoice)
      : null;
    if (!castVoice || !providerRegistration) {
      throw new ProjectDataError(
        'PROJECT_DATA386',
        'This cast member is missing a usable ElevenLabs Cast Voice provider registration.',
        {
          suggestion: MISSING_CAST_VOICE_REASON,
        },
      );
    }
    const plainText = requiredTrimmed(input.spec.plainText, 'plainText');
    const v3Text =
      input.spec.modelChoice === 'elevenlabs/eleven_v3'
        ? requiredTrimmed(input.spec.v3Text, 'v3Text')
        : input.spec.v3Text.trim();
    const voiceSettings = normalizeVoiceSettings(input.spec.voiceSettings);
    const textTreatment = textTreatmentForModel(input.spec.modelChoice);
    const providerText =
      textTreatment === 'elevenlabs-v3-audio-tags' ? v3Text : plainText;
    const spec: SceneDialogueAudioGenerationSpec = {
      ...input.spec,
      castVoiceId: castVoice.id,
      plainText,
      v3Text: v3Text || plainText,
      voiceSettings,
      outputFormat: input.spec.outputFormat?.trim() || DEFAULT_OUTPUT_FORMAT,
      languageCode: input.spec.languageCode?.trim() || null,
      title: input.spec.title?.trim() || undefined,
    };
    return {
      spec,
      castMemberId: dialogue.castMemberId,
      castVoice: {
        id: castVoice.id,
        name: castVoice.name,
        externalVoiceId: providerRegistration.externalVoiceId,
      },
      voiceSettings,
      providerText,
      textTreatment,
    };
  });
}

function prepared(
  specRecord: MediaGenerationSpecRecord,
  normalized: Awaited<ReturnType<typeof normalizeSpec>>,
): PreparedMediaGeneration {
  const providerPayload = buildProviderPayload(normalized);
  return {
    spec: specRecord,
    providerPayload,
    generation: {
      policy: {
        provider: 'elevenlabs',
        model: parseModel(normalized.spec.modelChoice),
        mediaKind: 'audio',
        mode: 'text-to-speech',
        outputCount: 1,
      },
      request: {
        parameters: providerPayload,
        outputNames: [outputName(normalized.spec)],
      },
    },
  };
}

function buildProviderPayload(
  normalized: Awaited<ReturnType<typeof normalizeSpec>>,
): Record<string, unknown> {
  return {
    text: normalized.providerText,
    voice: normalized.castVoice.externalVoiceId.trim(),
    output_format: normalized.spec.outputFormat ?? DEFAULT_OUTPUT_FORMAT,
    ...(normalized.spec.languageCode
      ? { language_code: normalized.spec.languageCode }
      : {}),
    voice_settings: {
      ...(normalized.voiceSettings.stability !== undefined
        ? { stability: normalized.voiceSettings.stability }
        : {}),
      ...(normalized.voiceSettings.similarityBoost !== undefined
        ? { similarity_boost: normalized.voiceSettings.similarityBoost }
        : {}),
      ...(normalized.voiceSettings.style !== undefined
        ? { style: normalized.voiceSettings.style }
        : {}),
      ...(normalized.voiceSettings.speed !== undefined
        ? { speed: normalized.voiceSettings.speed }
        : {}),
      ...(normalized.voiceSettings.useSpeakerBoost !== undefined
        ? { use_speaker_boost: normalized.voiceSettings.useSpeakerBoost }
        : {}),
    },
  };
}

function buildContextFromSession(
  session: DatabaseSession,
  sceneId: string,
): SceneDialogueAudioContext {
  const project = readProjectRecord(session);
  if (!project) {
    throw new ProjectDataError(
      'PROJECT_DATA020',
      'Project database has no project row.',
    );
  }
  const scene = readScreenplaySceneFromSession(session, sceneId);
  const castMemberLabels: Record<string, string> = {};
  const dialogues = scene.blocks
    .filter((block) => block.type === 'dialogue')
    .map((block) => {
      if (!block.dialogueId) {
        throw new ProjectDataError(
          'PROJECT_DATA380',
          'Dialogue block is missing a stable dialogueId.',
        );
      }
      const castMemberId = block.castMemberId ?? null;
      const speakerName = castMemberId ? castMemberId : 'Dialogue';
      if (castMemberId) {
        castMemberLabels[castMemberId] = castMemberId;
      }
      return {
        dialogueId: block.dialogueId,
        castMemberId,
        speakerName,
        plainText: block.lines.join('\n'),
      };
    });
  const records = listSceneDialogueAudioRecords(session, sceneId);
  const audioByDialogueId = Object.fromEntries(
    records.map((record) => [
      record.dialogueId,
      toSceneDialogueAudio(
        record,
        listSceneDialogueAudioTakeRecords(session, record.id),
      ),
    ]),
  );
  const castVoicesByCastMemberId: SceneDialogueAudioContext['castVoicesByCastMemberId'] =
    {};
  for (const dialogue of dialogues) {
    if (
      !dialogue.castMemberId ||
      castVoicesByCastMemberId[dialogue.castMemberId]
    ) {
      continue;
    }
    castVoicesByCastMemberId[dialogue.castMemberId] = listCastVoiceRecords(
      session,
      dialogue.castMemberId,
    )
      .map((voice) => {
        const registration = dialogueTtsRegistration(session, voice);
        if (!registration) {
          return null;
        }
        return {
          id: voice.id,
          castMemberId: voice.castMemberId,
          name: voice.name,
          provider: 'elevenlabs' as const,
          model: registration.registrationModel,
          voiceId: registration.externalVoiceId,
          purpose: voice.purpose,
          usable: Boolean(registration.externalVoiceId.trim()),
        };
      })
      .filter((voice) => voice !== null);
  }
  return {
    purpose: SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE,
    target: { kind: 'scene', sceneId },
    project: {
      name: project.name,
      title: project.title,
      baseLanguageCode: defaultLanguageCode(session),
    },
    scene: {
      id: sceneId,
      title: scene.title,
      settingLabel:
        [scene.setting.interiorExterior, scene.setting.timeOfDay]
          .filter(Boolean)
          .join(' ')
          .trim() || null,
    },
    dialogues,
    castMemberLabels,
    castVoicesByCastMemberId,
    audioByDialogueId,
    models: modelReports(),
    defaults: {
      modelChoice: DEFAULT_MODEL_CHOICE,
      outputFormat: DEFAULT_OUTPUT_FORMAT,
      languageCode: null,
      voiceSettings: DEFAULT_VOICE_SETTINGS,
    },
    resourceKeys: sceneDialogueAudioResourceKeys(
      sceneId,
      records.map((record) => record.id),
      records.flatMap((record) =>
        listSceneDialogueAudioTakeRecords(session, record.id).map(
          (take) => take.id,
        ),
      ),
    ),
  };
}

function requireDialogue(
  session: DatabaseSession,
  sceneId: string,
  dialogueId: string,
) {
  const scene = readScreenplaySceneFromSession(session, sceneId);
  const dialogue = scene.blocks.find(
    (block) => block.type === 'dialogue' && block.dialogueId === dialogueId,
  );
  if (!dialogue || dialogue.type !== 'dialogue') {
    throw new ProjectDataError(
      'PROJECT_DATA380',
      `Dialogue block was not found: ${dialogueId}.`,
    );
  }
  return dialogue;
}

function requireAudioForDialogue(
  session: DatabaseSession,
  sceneId: string,
  dialogueId: string,
) {
  const audio = readSceneDialogueAudioRecord(session, { sceneId, dialogueId });
  if (!audio) {
    throw new ProjectDataError(
      'PROJECT_DATA380',
      `Scene Dialogue Audio record was not found for dialogue: ${dialogueId}.`,
    );
  }
  return audio;
}

function defaultCastVoiceId(
  session: DatabaseSession,
  castMemberId: string | undefined,
): string {
  if (!castMemberId) {
    throw new ProjectDataError(
      'PROJECT_DATA386',
      'Dialogue has no Cast Member.',
      {
        suggestion:
          'Assign a Cast Member to the dialogue before generating audio.',
      },
    );
  }
  const voice = listCastVoiceRecords(session, castMemberId).find(
    (candidate) => Boolean(dialogueTtsRegistration(session, candidate)),
  );
  if (!voice) {
    throw new ProjectDataError(
      'PROJECT_DATA386',
      'This cast member is missing a usable ElevenLabs Cast Voice provider registration.',
      {
        suggestion: MISSING_CAST_VOICE_REASON,
      },
    );
  }
  return voice.id;
}

function normalizeOptionalCastVoiceId(
  session: DatabaseSession,
  input: { castMemberId: string; castVoiceId: string | null },
): string | null {
  if (!input.castVoiceId) {
    return null;
  }
  const voice = listCastVoiceRecords(session, input.castMemberId).find(
    (candidate) => candidate.id === input.castVoiceId,
  );
  if (!voice) {
    throw new ProjectDataError(
      'PROJECT_DATA386',
      'Selected Cast Voice belongs to another Cast Member.',
      { suggestion: 'Choose one of the speaker Cast Voices.' },
    );
  }
  return voice.id;
}

function dialogueTtsRegistration(
  session: DatabaseSession,
  voice: CastVoiceRecord,
): CastVoiceProviderRegistrationRecord | null {
  return (
    listCastVoiceProviderRegistrationRecords(session, voice.id).find(
      (registration) =>
        registration.provider === 'elevenlabs' &&
        registration.externalVoiceId.trim() &&
        registrationHasCapability(registration, 'dialogue-audio-tts'),
    ) ?? null
  );
}

function registrationHasCapability(
  registration: CastVoiceProviderRegistrationRecord,
  capability: string,
): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(registration.capabilitiesJson);
  } catch {
    throw new ProjectDataError(
      'PROJECT_DATA358',
      `Cast Voice provider registration ${registration.id} has invalid capabilities.`
    );
  }
  return Array.isArray(parsed) && parsed.includes(capability);
}

function modelReports(): SceneDialogueAudioModelListReport['models'] {
  return [
    modelReport('elevenlabs/eleven_v3', 'Eleven v3', true),
    modelReport(
      'elevenlabs/eleven_multilingual_v2',
      'Eleven Multilingual v2',
      false,
    ),
    modelReport('elevenlabs/eleven_turbo_v2_5', 'Eleven Turbo v2.5', false),
  ];
}

function modelReport(
  modelChoice: SceneDialogueAudioModelChoice,
  label: string,
  supportsAudioTags: boolean,
) {
  return {
    modelChoice,
    label,
    available: true as const,
    provider: 'elevenlabs' as const,
    model: parseModel(modelChoice),
    mediaKind: 'audio' as const,
    mode: 'text-to-speech' as const,
    supportsAudioTags,
    textTreatment: textTreatmentForModel(modelChoice),
    defaultVoiceSettings: DEFAULT_VOICE_SETTINGS,
    outputFormats: [DEFAULT_OUTPUT_FORMAT],
  };
}

function parseModel(
  modelChoice: SceneDialogueAudioModelChoice,
): 'eleven_v3' | 'eleven_multilingual_v2' | 'eleven_turbo_v2_5' {
  if (modelChoice === 'elevenlabs/eleven_v3') {
    return 'eleven_v3';
  }
  if (modelChoice === 'elevenlabs/eleven_multilingual_v2') {
    return 'eleven_multilingual_v2';
  }
  return 'eleven_turbo_v2_5';
}

function textTreatmentForModel(
  modelChoice: SceneDialogueAudioModelChoice,
): SceneDialogueAudioTextTreatment {
  return modelChoice === 'elevenlabs/eleven_v3'
    ? 'elevenlabs-v3-audio-tags'
    : 'plain-tts';
}

function normalizeVoiceSettings(
  input: SceneDialogueAudioVoiceSettings | undefined,
): SceneDialogueAudioVoiceSettings {
  const settings = { ...DEFAULT_VOICE_SETTINGS, ...input };
  for (const key of ['stability', 'similarityBoost', 'style'] as const) {
    const value = settings[key];
    if (value !== undefined && (value < 0 || value > 1)) {
      throw new ProjectDataError(
        'PROJECT_DATA386',
        `Voice setting ${key} must be between 0 and 1.`,
      );
    }
  }
  if (
    settings.speed !== undefined &&
    (settings.speed < 0.7 || settings.speed > 1.2)
  ) {
    throw new ProjectDataError(
      'PROJECT_DATA386',
      'Voice setting speed must be between 0.7 and 1.2.',
    );
  }
  return settings;
}

function parseVoiceSettings(
  input: string | null | undefined,
): SceneDialogueAudioVoiceSettings {
  if (!input) {
    return DEFAULT_VOICE_SETTINGS;
  }
  return normalizeVoiceSettings(
    JSON.parse(input) as SceneDialogueAudioVoiceSettings,
  );
}

function requiredTrimmed(input: string, fieldName: string): string {
  const value = input?.trim();
  if (!value) {
    throw new ProjectDataError(
      'PROJECT_DATA386',
      `Scene Dialogue Audio ${fieldName} cannot be empty.`,
    );
  }
  return value;
}

function titleForSpec(spec: SceneDialogueAudioGenerationSpec): string {
  return spec.title ?? `Scene dialogue ${spec.target.dialogueId}`;
}

function outputName(spec: SceneDialogueAudioGenerationSpec): string {
  return `${spec.target.dialogueId}.${extensionForOutputFormat(
    spec.outputFormat ?? DEFAULT_OUTPUT_FORMAT,
  )}`;
}

async function persistDialogueAudioTakeFile(input: {
  projectFolder: string;
  sourceProjectRelativePath: ProjectRelativePath;
  dialogueId: string;
  takeId: string;
  outputFormat: string | undefined;
}): Promise<ProjectRelativePath> {
  const extension = extensionForOutputFormat(
    input.outputFormat ?? DEFAULT_OUTPUT_FORMAT,
  );
  const fileName = `${slugify(input.dialogueId)}-${input.takeId}.${extension}`;
  const projectRelativePath =
    `generated/media/scene-dialogue-audio/${fileName}` as ProjectRelativePath;
  const sourcePath = path.join(
    input.projectFolder,
    input.sourceProjectRelativePath,
  );
  const targetPath = path.join(input.projectFolder, projectRelativePath);
  try {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(sourcePath, targetPath, fsConstants.COPYFILE_EXCL);
    await fs.unlink(sourcePath);
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'EEXIST'
    ) {
      throw new ProjectDataError(
        'PROJECT_DATA386',
        `Scene Dialogue Audio take file already exists: ${projectRelativePath}.`,
      );
    }
    throw error;
  }
  return projectRelativePath;
}

function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'dialogue';
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

function mimeTypeForOutputFormat(outputFormat: string | undefined): string {
  const extension = extensionForOutputFormat(
    outputFormat ?? DEFAULT_OUTPUT_FORMAT,
  );
  return extension === 'wav' ? 'audio/wav' : 'audio/mpeg';
}

function firstAudioOutput(outputs: unknown): {
  projectRelativePath: ProjectRelativePath;
  mimeType?: string | null;
} {
  if (!Array.isArray(outputs)) {
    throw new ProjectDataError(
      'PROJECT_DATA386',
      'Generation run has no audio output.',
    );
  }
  const output = outputs.find(
    (candidate) =>
      candidate &&
      typeof candidate === 'object' &&
      typeof (candidate as { projectRelativePath?: unknown })
        .projectRelativePath === 'string' &&
      isPersistedAudioOutput(candidate),
  ) as
    | { projectRelativePath: ProjectRelativePath; mimeType?: string | null }
    | undefined;
  if (!output) {
    throw new ProjectDataError(
      'PROJECT_DATA386',
      'Generation run has no audio output.',
    );
  }
  return output;
}

function isPersistedAudioOutput(candidate: object): boolean {
  const output = candidate as {
    mimeType?: unknown;
    projectRelativePath?: unknown;
  };
  if (typeof output.mimeType === 'string') {
    return output.mimeType.startsWith('audio/');
  }
  if (typeof output.projectRelativePath !== 'string') {
    return false;
  }
  return /\.(aac|flac|m4a|mp3|ogg|wav)$/i.test(output.projectRelativePath);
}

function defaultLanguageCode(session: DatabaseSession): string | null {
  const base = listProjectLocaleRecords(session).find((locale) => locale.isBase);
  return base?.localeTag.split('-')[0]?.toLowerCase() ?? null;
}

function assertSceneDialogueAudioSpec(
  spec: unknown,
): asserts spec is SceneDialogueAudioGenerationSpec {
  if (
    !spec ||
    typeof spec !== 'object' ||
    (spec as { purpose?: unknown }).purpose !==
      SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE
  ) {
    throw new ProjectDataError(
      'PROJECT_DATA384',
      'Media Generation Spec is not a Scene Dialogue Audio spec.',
    );
  }
}

async function mutationReport(input: {
  projectName?: string;
  homeDir?: string;
  sceneId: string;
}): Promise<SceneDialogueAudioMutationReport> {
  const context = await readSceneDialogueAudioContext(input);
  return {
    context,
    resourceKeys: context.resourceKeys,
  };
}

function sceneDialogueAudioResourceKeys(
  sceneId: string,
  audioIds: string[],
  takeIds: string[],
): string[] {
  return [
    `scene:${sceneId}`,
    `surface:scene:${sceneId}:dialogue-audio`,
    ...audioIds.map((audioId) => `scene-dialogue-audio:${audioId}`),
    ...takeIds.map((takeId) => `scene-dialogue-audio-take:${takeId}`),
  ];
}

async function withSceneDialogueAudioProjectSession<T>(
  input: RenkuConfigPathOptions & { projectName?: string },
  fn: (handle: {
    projectFolder: string;
    session: DatabaseSession;
  }) => T | Promise<T>,
): Promise<T> {
  if (input.projectName) {
    const handle = await openProjectSession({
      projectName: input.projectName,
      homeDir: input.homeDir,
    });
    try {
      return await fn({
        projectFolder: handle.projectFolder,
        session: handle.session,
      });
    } finally {
      handle.session.close();
    }
  }
  return withCurrentProjectSession(input, ({ currentProject, session }) =>
    fn({ projectFolder: currentProject.projectFolder, session }),
  );
}
