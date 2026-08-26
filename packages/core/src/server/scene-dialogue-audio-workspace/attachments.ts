import { and, eq } from 'drizzle-orm';
import type { Asset } from '../../client/assets.js';
import type { MediaGenerationProvenance } from '../../client/media-generation-review.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { readCastVoiceRecord, listCastVoiceProviderRegistrationRecords } from '../database/access/cast-voices.js';
import { readProjectRecord } from '../database/access/project.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import { readOwnedAsset } from '../assets/projection.js';
import { persistOwnedGeneratedMediaAssetInSession } from '../generation/attachment-persistence.js';
import {
  createProjectAssetFileWriteSet,
  rollbackProjectAssetFileWriteSetSync,
} from '../project-asset-files/index.js';
import { ProjectDataError } from '../project-data-error.js';
import { sceneDialogueAudio, sceneDialogueAudioTakes } from '../schema/index.js';
import { studioSceneDialogueAudioSurfaceResourceKey } from '../studio-coordination/resource-keys.js';

export function attachSceneDialogueAudioMedia(input: {
  session: DatabaseSession;
  projectFolder: string;
  sceneId: string;
  turnId: string;
  sourceProjectRelativePath: string;
  title?: string;
  generationProvenance: MediaGenerationProvenance;
  idGenerator: ProjectIdGenerator;
}): {
  asset: Asset;
  resourceKeys: string[];
  project: { projectName: string; id: string; projectFolder: string };
} {
  const audio = input.session.db.select().from(sceneDialogueAudio)
    .where(and(
      eq(sceneDialogueAudio.sceneId, input.sceneId),
      eq(sceneDialogueAudio.turnId, input.turnId),
    )).get();
  if (!audio || !audio.castVoiceId) {
    throw new ProjectDataError(
      'CORE_DIALOGUE_AUDIO_SETUP_REQUIRED',
      'Scene Dialogue Audio setup with a Cast Voice is required before attachment.',
    );
  }
  const voice = readCastVoiceRecord(input.session, {
    castMemberId: audio.castMemberId,
    voiceIdOrName: audio.castVoiceId,
  });
  const registration = voice
    ? listCastVoiceProviderRegistrationRecords(input.session, voice.id).find(
        (candidate) => candidate.provider === 'elevenlabs'
      )
    : null;
  if (!voice || !registration) {
    throw new ProjectDataError(
      'CORE_DIALOGUE_AUDIO_VOICE_INVALID',
      'The selected Cast Voice is not registered with ElevenLabs.',
    );
  }
  if (input.generationProvenance.provider !== 'elevenlabs'
    || input.generationProvenance.mediaKind !== 'audio'
    || input.generationProvenance.model !== audio.modelChoice.slice('elevenlabs/'.length)) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_PROVENANCE_INVALID',
      'Dialogue Audio provenance does not match the saved ElevenLabs setup.',
    );
  }
  const assetId = input.idGenerator.next('asset');
  const assetFileId = input.idGenerator.next('asset_file');
  const takeId = input.idGenerator.next('scene_dialogue_audio_take');
  const now = new Date().toISOString();
  const writeSet = createProjectAssetFileWriteSet({ projectFolder: input.projectFolder });
  try {
    input.session.db.transaction((tx) => {
      const session = { ...input.session, db: tx };
      persistOwnedGeneratedMediaAssetInSession({
        session,
        projectFolder: input.projectFolder,
        writeSet,
        assetId,
        assetFileId,
        now,
        sourceProjectRelativePath: input.sourceProjectRelativePath,
        destination: {
          kind: 'scene.dialogueAudio',
          sceneId: audio.sceneId,
          turnId: audio.turnId,
          sceneDialogueAudioId: audio.id,
          dialogueAudioTakeId: takeId,
        },
        owner: { kind: 'scene', id: audio.sceneId },
        asset: {
          type: 'scene_dialogue_audio',
          mediaKind: 'audio',
          title: input.title?.trim() || `${voice.name} Dialogue`,
          origin: 'generated',
        },
        fileRole: 'primary',
        generationProvenance: input.generationProvenance,
      });
      tx.insert(sceneDialogueAudioTakes).values({
        id: takeId,
        sceneDialogueAudioId: audio.id,
        assetId,
        assetFileId,
        modelChoice: audio.modelChoice,
        castVoiceId: voice.id,
        castVoiceName: voice.name,
        provider: 'elevenlabs',
        providerVoiceId: registration.externalVoiceId,
        providerTextSnapshot: audio.modelChoice === 'elevenlabs/eleven_v3'
          ? audio.v3Text
          : audio.plainText,
        plainTextSnapshot: audio.plainText,
        v3TextSnapshot: audio.v3Text,
        textTreatment: audio.modelChoice === 'elevenlabs/eleven_v3'
          ? 'elevenlabs-v3-audio-tags'
          : 'plain-tts',
        voiceSettingsSnapshotJson: audio.voiceSettingsJson,
        outputFormat: audio.outputFormat,
        languageCode: audio.languageCode,
        createdAt: now,
        updatedAt: now,
      }).run();
      writeSet.markCommitted();
    });
  } catch (error) {
    rollbackProjectAssetFileWriteSetSync(writeSet);
    throw error;
  }
  const asset = readOwnedAsset(input.session, {
    owner: { kind: 'scene', id: audio.sceneId },
    assetId,
  });
  const project = readProjectRecord(input.session);
  if (!asset || !project) {
    throw new ProjectDataError('CORE_GENERATION_ATTACHMENT_FAILED', 'Dialogue Audio attachment was not persisted.');
  }
  return {
    asset,
    resourceKeys: [studioSceneDialogueAudioSurfaceResourceKey(audio.sceneId)],
    project: { projectName: project.projectName, id: project.id, projectFolder: input.projectFolder },
  };
}
