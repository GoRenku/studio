import { eq } from 'drizzle-orm';
import type {
  SceneDialogueAudioSetup,
  SceneDialogueAudioWorkspaceMutationReport,
} from '../../client/scene-dialogue-audio-workspace.js';
import { listCastVoiceProviderRegistrationRecords, readCastVoiceRecord } from '../database/access/cast-voices.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import { ProjectDataError } from '../project-data-error.js';
import { sceneDialogueAudio } from '../schema/index.js';
import { readSceneDialogueAudioWorkspace } from './context.js';

export function updateSceneDialogueAudioSetup(input: {
  session: DatabaseSession;
  sceneId: string;
  dialogueId: string;
  setup: Partial<SceneDialogueAudioSetup>;
  idGenerator: ProjectIdGenerator;
  now: string;
}): SceneDialogueAudioWorkspaceMutationReport {
  const setup = resolveSetup(input);
  const current = input.session.db
    .select()
    .from(sceneDialogueAudio)
    .where(eq(sceneDialogueAudio.dialogueId, input.dialogueId))
    .get();
  const id = current?.id ?? input.idGenerator.next('scene_dialogue_audio');
  input.session.db
    .insert(sceneDialogueAudio)
    .values({
      id,
      sceneId: input.sceneId,
      dialogueId: input.dialogueId,
      castMemberId: setup.castMemberId,
      castVoiceId: setup.castVoiceId,
      modelChoice: setup.modelChoice,
      plainText: setup.plainText,
      v3Text: setup.v3Text,
      voiceSettingsJson: JSON.stringify(setup.voiceSettings),
      outputFormat: setup.outputFormat,
      languageCode: setup.languageCode,
      createdAt: current?.createdAt ?? input.now,
      updatedAt: input.now,
    })
    .onConflictDoUpdate({
      target: [sceneDialogueAudio.sceneId, sceneDialogueAudio.dialogueId],
      set: {
        castMemberId: setup.castMemberId,
        castVoiceId: setup.castVoiceId,
        modelChoice: setup.modelChoice,
        plainText: setup.plainText,
        v3Text: setup.v3Text,
        voiceSettingsJson: JSON.stringify(setup.voiceSettings),
        outputFormat: setup.outputFormat,
        languageCode: setup.languageCode,
        updatedAt: input.now,
      },
    })
    .run();
  const context = readSceneDialogueAudioWorkspace(input);
  return { context, resourceKeys: context.resourceKeys };
}

export function requireSceneDialogueAudioSetup(input: {
  session: DatabaseSession;
  sceneId: string;
  dialogueId: string;
}): SceneDialogueAudioSetup {
  const row = input.session.db
    .select()
    .from(sceneDialogueAudio)
    .where(eq(sceneDialogueAudio.dialogueId, input.dialogueId))
    .get();
  if (!row || row.sceneId !== input.sceneId || !row.castVoiceId) {
    throw new ProjectDataError(
      'CORE_DIALOGUE_AUDIO_SETUP_REQUIRED',
      `Scene Dialogue Audio setup is incomplete: ${input.dialogueId}.`
    );
  }
  return {
    purpose: 'scene.dialogue-audio',
    target: {
      kind: 'sceneDialogue',
      sceneId: row.sceneId,
      dialogueId: row.dialogueId,
    },
    modelChoice: modelChoice(row.modelChoice),
    castVoiceId: row.castVoiceId,
    plainText: row.plainText,
    v3Text: row.v3Text,
    voiceSettings: JSON.parse(row.voiceSettingsJson),
    outputFormat: row.outputFormat,
    languageCode: row.languageCode,
  };
}

function resolveSetup(input: {
  session: DatabaseSession;
  sceneId: string;
  dialogueId: string;
  setup: Partial<SceneDialogueAudioSetup>;
}) {
  const workspace = readSceneDialogueAudioWorkspace(input);
  const dialogue = workspace.dialogues.find(
    (candidate) => candidate.dialogueId === input.dialogueId
  );
  if (!dialogue?.castMemberId) {
    throw new ProjectDataError(
      'CORE_DIALOGUE_AUDIO_DIALOGUE_INVALID',
      `Dialogue is not assigned to a Cast Member: ${input.dialogueId}.`
    );
  }
  const current = workspace.audioByDialogueId[input.dialogueId];
  const castVoiceId = input.setup.castVoiceId ?? current?.castVoiceId;
  if (!castVoiceId) {
    throw new ProjectDataError(
      'CORE_DIALOGUE_AUDIO_VOICE_REQUIRED',
      'Scene Dialogue Audio requires a Cast Voice.'
    );
  }
  const voice = readCastVoiceRecord(input.session, {
    castMemberId: dialogue.castMemberId,
    voiceIdOrName: castVoiceId,
  });
  const registration = voice
    ? listCastVoiceProviderRegistrationRecords(input.session, voice.id).find(
        (candidate) => candidate.provider === 'elevenlabs'
      )
    : null;
  if (!voice || !registration) {
    throw new ProjectDataError(
      'CORE_DIALOGUE_AUDIO_VOICE_INVALID',
      'The selected Cast Voice is not usable with ElevenLabs.'
    );
  }
  return {
    castMemberId: dialogue.castMemberId,
    castVoiceId: voice.id,
    modelChoice: modelChoice(
      input.setup.modelChoice ??
        current?.modelChoice ??
        workspace.defaults.modelChoice
    ),
    plainText: input.setup.plainText ?? current?.plainText ?? dialogue.plainText,
    v3Text: input.setup.v3Text ?? current?.v3Text ?? dialogue.plainText,
    voiceSettings:
      input.setup.voiceSettings ??
      current?.voiceSettings ??
      workspace.defaults.voiceSettings,
    outputFormat:
      input.setup.outputFormat ??
      current?.outputFormat ??
      workspace.defaults.outputFormat,
    languageCode:
      input.setup.languageCode !== undefined
        ? input.setup.languageCode
        : current?.languageCode ?? workspace.defaults.languageCode,
  };
}

function modelChoice(value: string) {
  if (
    value === 'elevenlabs/eleven_v3' ||
    value === 'elevenlabs/eleven_multilingual_v2' ||
    value === 'elevenlabs/eleven_turbo_v2_5'
  ) {
    return value;
  }
  throw new ProjectDataError(
    'CORE_DIALOGUE_AUDIO_MODEL_INVALID',
    `Unsupported Scene Dialogue Audio model: ${value}.`
  );
}
