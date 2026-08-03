import { and, asc, eq, isNull } from 'drizzle-orm';
import type {
  SceneDialogueAudioModelChoice,
  SceneDialogueAudioModelChoiceReport,
  SceneDialogueAudioVoiceSettings,
  SceneDialogueAudioWorkspace,
} from '../../client/scene-dialogue-audio-workspace.js';
import { listCastMemberRecords } from '../database/access/cast-members.js';
import { listCastVoiceProviderRegistrationRecords, listCastVoiceRecords } from '../database/access/cast-voices.js';
import { readProjectRecord } from '../database/access/project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import { readCanonicalScreenplay } from '../screenplay/projections/screenplay.js';
import { assetFileGenerations, sceneDialogueAudio, sceneDialogueAudioTakes } from '../schema/index.js';
import { studioSceneDialogueAudioSurfaceResourceKey } from '../studio-coordination/resource-keys.js';
import { listSceneDialogueTurns } from './turns.js';

const DEFAULT_MODEL: SceneDialogueAudioModelChoice = 'elevenlabs/eleven_v3';
const DEFAULT_OUTPUT_FORMAT = 'mp3_44100_128';
const DEFAULT_VOICE_SETTINGS: SceneDialogueAudioVoiceSettings = {};

export function readSceneDialogueAudioWorkspace(input: {
  session: DatabaseSession;
  sceneId: string;
}): SceneDialogueAudioWorkspace {
  const project = readProjectRecord(input.session);
  const screenplay = readCanonicalScreenplay(input.session);
  const scene = screenplay.scenes.find((candidate) => candidate.id === input.sceneId);
  if (!project || !scene) {
    throw new ProjectDataError('CORE_DIALOGUE_AUDIO_CONTEXT_NOT_FOUND', `Scene Dialogue Audio context was not found: ${input.sceneId}.`);
  }
  const castMembers = listCastMemberRecords(input.session);
  const dialogues = listSceneDialogueTurns(screenplay, scene.id).map((context) => ({
    turnId: context.turn.id,
    castMemberId: context.castMemberId,
    speakerName: castMembers.find((member) => member.id === context.castMemberId)?.name ?? context.turn.characterName,
    plainText: context.plainText,
  }));
  const audioRows = input.session.db.select().from(sceneDialogueAudio)
    .where(eq(sceneDialogueAudio.sceneId, input.sceneId)).all();
  const audioByTurnId = Object.fromEntries(audioRows.map((audio) => {
    const takes = input.session.db
      .select({ take: sceneDialogueAudioTakes, generationRunId: assetFileGenerations.mediaGenerationRunId })
      .from(sceneDialogueAudioTakes)
      .leftJoin(assetFileGenerations, eq(assetFileGenerations.assetFileId, sceneDialogueAudioTakes.assetFileId))
      .where(and(eq(sceneDialogueAudioTakes.sceneDialogueAudioId, audio.id), isNull(sceneDialogueAudioTakes.discardedAt)))
      .orderBy(asc(sceneDialogueAudioTakes.createdAt))
      .all()
      .map(({ take, generationRunId }) => ({
        takeId: take.id,
        sceneDialogueAudioId: take.sceneDialogueAudioId,
        assetId: take.assetId,
        assetFileId: take.assetFileId,
        generationRunId: generationRunId ?? '',
        modelChoice: requireModelChoice(take.modelChoice),
        castVoiceId: take.castVoiceId,
        castVoiceName: take.castVoiceName,
        provider: 'elevenlabs' as const,
        providerVoiceId: take.providerVoiceId,
        providerTextSnapshot: take.providerTextSnapshot,
        plainTextSnapshot: take.plainTextSnapshot,
        v3TextSnapshot: take.v3TextSnapshot,
        textTreatment: take.textTreatment === 'elevenlabs-v3-audio-tags' ? 'elevenlabs-v3-audio-tags' as const : 'plain-tts' as const,
        voiceSettingsSnapshot: parseVoiceSettings(take.voiceSettingsSnapshotJson),
        outputFormat: take.outputFormat,
        languageCode: take.languageCode,
        createdAt: take.createdAt,
      }));
    return [audio.turnId, {
      id: audio.id,
      sceneId: audio.sceneId,
      turnId: audio.turnId,
      castMemberId: audio.castMemberId,
      castVoiceId: audio.castVoiceId,
      modelChoice: requireModelChoice(audio.modelChoice),
      plainText: audio.plainText,
      v3Text: audio.v3Text,
      voiceSettings: parseVoiceSettings(audio.voiceSettingsJson),
      outputFormat: audio.outputFormat,
      languageCode: audio.languageCode,
      takes,
      createdAt: audio.createdAt,
      updatedAt: audio.updatedAt,
    }];
  }));
  const castVoicesByCastMemberId = Object.fromEntries(castMembers.map((member) => {
    const voices = listCastVoiceRecords(input.session, member.id).flatMap((voice) =>
      listCastVoiceProviderRegistrationRecords(input.session, voice.id)
        .filter((registration) => registration.provider === 'elevenlabs')
        .map((registration) => ({
          id: voice.id,
          castMemberId: member.id,
          name: voice.name,
          provider: 'elevenlabs' as const,
          model: registration.registrationModel,
          voiceId: registration.externalVoiceId,
          purpose: voice.purpose,
          usable: true,
        })),
    );
    return [member.id, voices];
  }));
  return {
    purpose: 'scene.dialogue-audio',
    target: { kind: 'scene', sceneId: input.sceneId },
    project: { projectName: project.projectName, title: project.title, baseLanguageCode: null },
    scene: {
      id: scene.id,
      heading: scene.heading,
      ...(scene.title ? { title: scene.title } : {}),
    },
    dialogues,
    castMemberLabels: Object.fromEntries(castMembers.map((member) => [member.id, member.name])),
    castVoicesByCastMemberId,
    audioByTurnId,
    models: dialogueAudioModels(),
    defaults: {
      modelChoice: DEFAULT_MODEL,
      outputFormat: DEFAULT_OUTPUT_FORMAT,
      languageCode: null,
      voiceSettings: DEFAULT_VOICE_SETTINGS,
    },
    resourceKeys: [studioSceneDialogueAudioSurfaceResourceKey(input.sceneId)],
  };
}

function dialogueAudioModels(): SceneDialogueAudioModelChoiceReport[] {
  return [
    model('elevenlabs/eleven_v3', 'Eleven v3', 'eleven_v3', true),
    model('elevenlabs/eleven_multilingual_v2', 'Eleven Multilingual v2', 'eleven_multilingual_v2', false),
    model('elevenlabs/eleven_turbo_v2_5', 'Eleven Turbo v2.5', 'eleven_turbo_v2_5', false),
  ];
}

function model(
  modelChoice: SceneDialogueAudioModelChoice,
  label: string,
  providerModel: SceneDialogueAudioModelChoiceReport['model'],
  supportsAudioTags: boolean,
): SceneDialogueAudioModelChoiceReport {
  return {
    modelChoice,
    label,
    available: true,
    provider: 'elevenlabs',
    model: providerModel,
    mediaKind: 'audio',
    mode: 'text-to-speech',
    supportsAudioTags,
    textTreatment: supportsAudioTags ? 'elevenlabs-v3-audio-tags' : 'plain-tts',
    defaultVoiceSettings: {},
    outputFormats: [DEFAULT_OUTPUT_FORMAT],
  };
}

function requireModelChoice(value: string): SceneDialogueAudioModelChoice {
  if (value === 'elevenlabs/eleven_v3' || value === 'elevenlabs/eleven_multilingual_v2' || value === 'elevenlabs/eleven_turbo_v2_5') {
    return value;
  }
  throw new ProjectDataError('CORE_DIALOGUE_AUDIO_MODEL_INVALID', `Unsupported Scene Dialogue Audio model: ${value}.`);
}

function parseVoiceSettings(value: string): SceneDialogueAudioVoiceSettings {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error();
    }
    return parsed as SceneDialogueAudioVoiceSettings;
  } catch {
    throw new ProjectDataError('CORE_DIALOGUE_AUDIO_SETTINGS_INVALID', 'Scene Dialogue Audio voice settings are invalid.');
  }
}
