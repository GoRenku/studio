import { eq } from 'drizzle-orm';
import {
  bindGenerationSemanticValues,
  describeGenerationModelInputs,
} from '@gorenku/studio-engines';
import type {
  GenerationSpec,
  JsonValue,
} from '../../client/generation.js';
import type {
  SceneDialogueAudioEstimateReport,
  SceneDialogueAudioSetup,
  SceneDialogueAudioWorkspaceMutationReport,
} from '../../client/scene-dialogue-audio-workspace.js';
import { recordImportedAssetFileGenerationProvenanceInSession } from '../asset-file-generation/import-provenance.js';
import { insertAssetRelationshipRecord, nextAssetRelationshipSortOrder } from '../database/access/asset-relationships/index.js';
import { insertAssetRecord } from '../database/access/assets.js';
import { listCastVoiceProviderRegistrationRecords, readCastVoiceRecord } from '../database/access/cast-voices.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import { estimateGeneration } from '../generation/estimates.js';
import { readGenerationPurpose } from '../generation/purposes.js';
import { runGeneration } from '../generation/runs.js';
import { resolveGenerationRunOutputRoot } from '../project-asset-files/index.js';
import { effectiveProjectAspectRatio } from '../database/access/project-information.js';
import { readProjectRecord } from '../database/access/project.js';
import { createGenerationSpec } from '../generation/specs.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  createProjectAssetFileWriteSet,
  persistProjectAssetFileSync,
  rollbackProjectAssetFileWriteSetSync,
} from '../project-asset-files/index.js';
import { sceneDialogueAudio, sceneDialogueAudioTakes } from '../schema/index.js';
import { readSceneDialogueAudioWorkspace } from './context.js';
import { requireSceneDialogueAudioSetup, updateSceneDialogueAudioSetup } from './setup.js';

export async function estimateSceneDialogueAudioDraft(input: {
  session: DatabaseSession;
  projectFolder: string;
  setup: SceneDialogueAudioSetup;
}): Promise<SceneDialogueAudioEstimateReport> {
  const spec = await buildSceneDialogueAudioSpec(input);
  const estimate = await estimateGeneration({
    spec,
    purpose: readGenerationPurpose('scene.dialogue-audio'),
  });
  if (!estimate.valid) {
    throw new ProjectDataError(
      'CORE_DIALOGUE_AUDIO_ESTIMATE_INVALID',
      'Scene Dialogue Audio estimate failed.',
      { issues: estimate.diagnostics }
    );
  }
  return { spec, estimate: estimate.estimate };
}

export async function generateSceneDialogueAudioTake(input: {
  session: DatabaseSession;
  projectFolder: string;
  sceneId: string;
  dialogueId: string;
  setup: Partial<SceneDialogueAudioSetup>;
  simulate?: boolean;
  approveLiveProviderRun?: boolean;
  idGenerator: ProjectIdGenerator;
  now: string;
}): Promise<SceneDialogueAudioWorkspaceMutationReport> {
  if (!input.simulate && input.approveLiveProviderRun !== true) {
    throw new ProjectDataError(
      'CORE_GENERATION_LIVE_APPROVAL_REQUIRED',
      'Scene Dialogue Audio requires explicit approval for a live provider run.'
    );
  }
  updateSceneDialogueAudioSetup(input);
  const setup = requireSceneDialogueAudioSetup(input);
  const spec = await buildSceneDialogueAudioSpec({ ...input, setup });
  const purpose = readGenerationPurpose('scene.dialogue-audio');
  const specId = input.idGenerator.next('media_generation_spec');
  const record = createGenerationSpec({
    id: specId,
    spec,
    purpose,
    session: input.session,
    now: input.now,
  });
  const estimate = await estimateGeneration({
    spec: record.spec,
    purpose,
  });
  if (!estimate.valid) {
    throw new ProjectDataError(
      'CORE_DIALOGUE_AUDIO_ESTIMATE_INVALID',
      'Scene Dialogue Audio estimate failed.',
      { issues: estimate.diagnostics }
    );
  }
  const runId = input.idGenerator.next('media_generation_run');
  const outputRoot = await resolveGenerationRunOutputRoot({
    projectFolder: input.projectFolder,
    runId,
    purpose: purpose.purpose,
  });
  const report = await runGeneration({
    id: runId,
    specRecord: record,
    purpose,
    projectAspectRatio: effectiveProjectAspectRatio(readProjectRecord(input.session)?.aspectRatio),
    approvalToken: estimate.estimate.approvalToken,
    mode: input.simulate ? 'simulated' : 'live',
    session: input.session,
    projectFolder: input.projectFolder,
    outputRoot: outputRoot.absoluteRoot,
    outputProjectRelativeRoot: outputRoot.projectRelativeRoot,
    now: input.now,
  });
  if (!report.valid) {
    throw new ProjectDataError(
      'CORE_DIALOGUE_AUDIO_GENERATION_FAILED',
      'Scene Dialogue Audio generation failed.',
      { issues: report.diagnostics }
    );
  }
  const output = report.run.outputs.find(
    (candidate) => candidate.projectRelativePath
  );
  if (!output?.projectRelativePath) {
    throw new ProjectDataError(
      'CORE_DIALOGUE_AUDIO_OUTPUT_MISSING',
      'Scene Dialogue Audio generation produced no attachable output.'
    );
  }
  attachDialogueAudioTake({
    ...input,
    setup,
    run: report.run,
    sourceProjectRelativePath: output.projectRelativePath,
  });
  const context = readSceneDialogueAudioWorkspace(input);
  return { context, resourceKeys: context.resourceKeys };
}

async function buildSceneDialogueAudioSpec(input: {
  session: DatabaseSession;
  setup: SceneDialogueAudioSetup;
}): Promise<GenerationSpec> {
  const providerModel = input.setup.modelChoice.slice('elevenlabs/'.length);
  const descriptor = await describeGenerationModelInputs({
    provider: 'elevenlabs',
    model: providerModel,
  });
  if (!descriptor) {
    throw new ProjectDataError(
      'CORE_DIALOGUE_AUDIO_MODEL_INVALID',
      `Scene Dialogue Audio model is unavailable: ${input.setup.modelChoice}.`
    );
  }
  const voice = readCastVoiceRecord(input.session, {
    castMemberId: requireDialogueCastMemberId(input),
    voiceIdOrName: input.setup.castVoiceId,
  });
  const registration = voice
    ? listCastVoiceProviderRegistrationRecords(input.session, voice.id).find(
        (candidate) => candidate.provider === 'elevenlabs'
      )
    : null;
  if (!voice || !registration) {
    throw new ProjectDataError(
      'CORE_DIALOGUE_AUDIO_VOICE_INVALID',
      'The selected Cast Voice is not registered with ElevenLabs.'
    );
  }
  const text = input.setup.modelChoice === 'elevenlabs/eleven_v3'
    ? input.setup.v3Text
    : input.setup.plainText;
  return {
    purpose: 'scene.dialogue-audio',
    target: { kind: 'sceneDialogue', id: input.setup.target.dialogueId },
    executionKind: 'renku-managed',
    model: { provider: 'elevenlabs', model: providerModel },
    values: bindGenerationSemanticValues({
      descriptor,
      values: {
        prompt: text,
        voice: registration.externalVoiceId,
        voiceSettings: input.setup.voiceSettings,
        outputFormat: input.setup.outputFormat,
        language: input.setup.languageCode,
      },
    }) as Record<string, JsonValue>,
    references: [],
    title: input.setup.title ?? 'Dialogue Audio',
  };
}

function requireDialogueCastMemberId(input: {
  session: DatabaseSession;
  setup: SceneDialogueAudioSetup;
}): string {
  const row = input.session.db
    .select({ castMemberId: sceneDialogueAudio.castMemberId })
    .from(sceneDialogueAudio)
    .where(eq(sceneDialogueAudio.dialogueId, input.setup.target.dialogueId))
    .get();
  if (!row) {
    throw new ProjectDataError(
      'CORE_DIALOGUE_AUDIO_SETUP_REQUIRED',
      'Scene Dialogue Audio setup must be saved before estimate or generation.'
    );
  }
  return row.castMemberId;
}

function attachDialogueAudioTake(input: {
  session: DatabaseSession;
  projectFolder: string;
  sceneId: string;
  dialogueId: string;
  setup: SceneDialogueAudioSetup;
  run: import('../../client/generation.js').GenerationRun;
  sourceProjectRelativePath: string;
  idGenerator: ProjectIdGenerator;
  now: string;
}): void {
  const audio = input.session.db
    .select()
    .from(sceneDialogueAudio)
    .where(eq(sceneDialogueAudio.dialogueId, input.dialogueId))
    .get();
  if (!audio || audio.sceneId !== input.sceneId) {
    throw new ProjectDataError(
      'CORE_DIALOGUE_AUDIO_SETUP_REQUIRED',
      'Scene Dialogue Audio setup is missing for the generated output.'
    );
  }
  const voice = readCastVoiceRecord(input.session, {
    castMemberId: audio.castMemberId,
    voiceIdOrName: input.setup.castVoiceId,
  });
  const registration = voice
    ? listCastVoiceProviderRegistrationRecords(input.session, voice.id).find(
        (candidate) => candidate.provider === 'elevenlabs'
      )
    : null;
  if (!voice || !registration || !input.run.receipt) {
    throw new ProjectDataError(
      'CORE_DIALOGUE_AUDIO_ATTACHMENT_INVALID',
      'Generated dialogue audio is missing voice or provenance data.'
    );
  }
  const assetId = input.idGenerator.next('asset');
  const assetFileId = input.idGenerator.next('asset_file');
  const takeId = input.idGenerator.next('scene_dialogue_audio_take');
  const relationshipId = input.idGenerator.next('scene_asset');
  const owner = { kind: 'scene' as const, sceneId: input.sceneId };
  const writeSet = createProjectAssetFileWriteSet({
    projectFolder: input.projectFolder,
  });
  try {
    input.session.db.transaction((tx) => {
      const session = { ...input.session, db: tx };
      insertAssetRecord(session, {
        id: assetId,
        type: 'scene-dialogue-audio',
        mediaKind: 'audio',
        title: `${voice.name} Dialogue`,
        origin: 'generated',
        availability: 'ready',
        createdAt: input.now,
        updatedAt: input.now,
      });
      persistProjectAssetFileSync({
        session,
        projectFolder: input.projectFolder,
        writeSet,
        assetId,
        assetFileId,
        sourceProjectRelativePath: input.sourceProjectRelativePath,
        destination: {
          kind: 'scene.dialogueAudio',
          sceneId: input.sceneId,
          dialogueId: input.dialogueId,
          sceneDialogueAudioId: audio.id,
          dialogueAudioTakeId: takeId,
        },
        fileRole: 'primary',
        mediaKind: 'audio',
        now: input.now,
      });
      insertAssetRelationshipRecord(session, owner, {
        relationshipId,
        assetId,
        localeId: null,
        role: 'dialogue-audio',
        sortOrder: nextAssetRelationshipSortOrder(session, {
          target: owner,
          role: 'dialogue-audio',
          localeId: null,
        }),
        now: input.now,
      });
      recordImportedAssetFileGenerationProvenanceInSession({
        session,
        assetFileId,
        receipt: input.run.receipt,
      });
      tx.insert(sceneDialogueAudioTakes).values({
        id: takeId,
        sceneDialogueAudioId: audio.id,
        assetId,
        assetFileId,
        modelChoice: input.setup.modelChoice,
        castVoiceId: voice.id,
        castVoiceName: voice.name,
        provider: 'elevenlabs',
        providerVoiceId: registration.externalVoiceId,
        providerTextSnapshot:
          input.setup.modelChoice === 'elevenlabs/eleven_v3'
            ? input.setup.v3Text
            : input.setup.plainText,
        plainTextSnapshot: input.setup.plainText,
        v3TextSnapshot: input.setup.v3Text,
        textTreatment:
          input.setup.modelChoice === 'elevenlabs/eleven_v3'
            ? 'elevenlabs-v3-audio-tags'
            : 'plain-tts',
        voiceSettingsSnapshotJson: JSON.stringify(
          input.setup.voiceSettings ?? {}
        ),
        outputFormat: input.setup.outputFormat ?? 'mp3_44100_128',
        languageCode: input.setup.languageCode ?? null,
        createdAt: input.now,
        updatedAt: input.now,
      }).run();
      writeSet.markCommitted();
    });
  } catch (error) {
    rollbackProjectAssetFileWriteSetSync(writeSet);
    throw error;
  }
}
