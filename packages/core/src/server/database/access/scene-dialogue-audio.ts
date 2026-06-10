import { and, desc, eq } from 'drizzle-orm';
import type {
  SceneDialogueAudio,
  SceneDialogueAudioModelChoice,
  SceneDialogueAudioTake,
  SceneDialogueAudioTextTreatment,
  SceneDialogueAudioVoiceSettings,
} from '../../../client/index.js';
import {
  sceneDialogueAudio,
  sceneDialogueAudioTakes,
} from '../../schema/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type SceneDialogueAudioRecord = typeof sceneDialogueAudio.$inferSelect;
export type SceneDialogueAudioTakeRecord =
  typeof sceneDialogueAudioTakes.$inferSelect;

export interface UpsertSceneDialogueAudioRecordInput {
  id: string;
  sceneId: string;
  dialogueId: string;
  castMemberId: string;
  castVoiceId: string | null;
  modelChoice: SceneDialogueAudioModelChoice;
  plainText: string;
  v3Text: string;
  voiceSettings: SceneDialogueAudioVoiceSettings;
  outputFormat: string;
  languageCode: string | null;
  now: string;
}

export interface InsertSceneDialogueAudioTakeRecordInput {
  id: string;
  sceneDialogueAudioId: string;
  assetId: string;
  assetFileId: string;
  mediaGenerationRunId: string;
  modelChoice: SceneDialogueAudioModelChoice;
  castVoiceId: string;
  castVoiceName: string;
  provider: 'elevenlabs';
  providerVoiceId: string;
  providerTextSnapshot: string;
  plainTextSnapshot: string;
  v3TextSnapshot: string;
  textTreatment: SceneDialogueAudioTextTreatment;
  voiceSettingsSnapshot: SceneDialogueAudioVoiceSettings;
  outputFormat: string;
  languageCode: string | null;
  now: string;
}

export function readSceneDialogueAudioRecord(
  session: DatabaseSession,
  input: { sceneId: string; dialogueId: string }
): SceneDialogueAudioRecord | null {
  return (
    session.db
      .select()
      .from(sceneDialogueAudio)
      .where(
        and(
          eq(sceneDialogueAudio.sceneId, input.sceneId),
          eq(sceneDialogueAudio.dialogueId, input.dialogueId)
        )
      )
      .get() ?? null
  );
}

export function listSceneDialogueAudioRecords(
  session: DatabaseSession,
  sceneId: string
): SceneDialogueAudioRecord[] {
  return session.db
    .select()
    .from(sceneDialogueAudio)
    .where(eq(sceneDialogueAudio.sceneId, sceneId))
    .all();
}

export function upsertSceneDialogueAudioRecord(
  session: DatabaseSession,
  input: UpsertSceneDialogueAudioRecordInput
): SceneDialogueAudioRecord {
  const existing = readSceneDialogueAudioRecord(session, input);
  const values = {
    castMemberId: input.castMemberId,
    castVoiceId: input.castVoiceId,
    modelChoice: input.modelChoice,
    plainText: input.plainText,
    v3Text: input.v3Text,
    voiceSettingsJson: JSON.stringify(input.voiceSettings),
    outputFormat: input.outputFormat,
    languageCode: input.languageCode,
    updatedAt: input.now,
  };
  if (existing) {
    session.db
      .update(sceneDialogueAudio)
      .set(values)
      .where(eq(sceneDialogueAudio.id, existing.id))
      .run();
    return requireSceneDialogueAudioRecordById(session, existing.id);
  }
  session.db
    .insert(sceneDialogueAudio)
    .values({
      id: input.id,
      sceneId: input.sceneId,
      dialogueId: input.dialogueId,
      ...values,
      pickedTakeId: null,
      createdAt: input.now,
    })
    .run();
  return requireSceneDialogueAudioRecordById(session, input.id);
}

export function requireSceneDialogueAudioRecordById(
  session: DatabaseSession,
  id: string
): SceneDialogueAudioRecord {
  const record =
    session.db
      .select()
      .from(sceneDialogueAudio)
      .where(eq(sceneDialogueAudio.id, id))
      .get() ?? null;
  if (!record) {
    throw new ProjectDataError(
      'PROJECT_DATA380',
      `Scene Dialogue Audio record was not found: ${id}.`
    );
  }
  return record;
}

export function listSceneDialogueAudioTakeRecords(
  session: DatabaseSession,
  sceneDialogueAudioId: string
): SceneDialogueAudioTakeRecord[] {
  return session.db
    .select()
    .from(sceneDialogueAudioTakes)
    .where(eq(sceneDialogueAudioTakes.sceneDialogueAudioId, sceneDialogueAudioId))
    .orderBy(desc(sceneDialogueAudioTakes.createdAt), desc(sceneDialogueAudioTakes.id))
    .all();
}

export function insertSceneDialogueAudioTakeRecord(
  session: DatabaseSession,
  input: InsertSceneDialogueAudioTakeRecordInput
): SceneDialogueAudioTakeRecord {
  session.db
    .insert(sceneDialogueAudioTakes)
    .values({
      id: input.id,
      sceneDialogueAudioId: input.sceneDialogueAudioId,
      assetId: input.assetId,
      assetFileId: input.assetFileId,
      mediaGenerationRunId: input.mediaGenerationRunId,
      modelChoice: input.modelChoice,
      castVoiceId: input.castVoiceId,
      castVoiceName: input.castVoiceName,
      provider: input.provider,
      providerVoiceId: input.providerVoiceId,
      providerTextSnapshot: input.providerTextSnapshot,
      plainTextSnapshot: input.plainTextSnapshot,
      v3TextSnapshot: input.v3TextSnapshot,
      textTreatment: input.textTreatment,
      voiceSettingsSnapshotJson: JSON.stringify(input.voiceSettingsSnapshot),
      outputFormat: input.outputFormat,
      languageCode: input.languageCode,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .run();
  const record = readSceneDialogueAudioTakeRecord(session, {
    sceneDialogueAudioId: input.sceneDialogueAudioId,
    takeId: input.id,
  });
  if (!record) {
    throw new ProjectDataError(
      'PROJECT_DATA381',
      `Scene Dialogue Audio take was not inserted: ${input.id}.`
    );
  }
  return record;
}

export function readSceneDialogueAudioTakeRecord(
  session: DatabaseSession,
  input: { sceneDialogueAudioId: string; takeId: string }
): SceneDialogueAudioTakeRecord | null {
  return (
    session.db
      .select()
      .from(sceneDialogueAudioTakes)
      .where(
        and(
          eq(sceneDialogueAudioTakes.sceneDialogueAudioId, input.sceneDialogueAudioId),
          eq(sceneDialogueAudioTakes.id, input.takeId)
        )
      )
      .get() ?? null
  );
}

export function pickSceneDialogueAudioTakeRecord(
  session: DatabaseSession,
  input: { sceneDialogueAudioId: string; takeId: string; updatedAt: string }
): void {
  const take = readSceneDialogueAudioTakeRecord(session, input);
  if (!take) {
    throw new ProjectDataError(
      'PROJECT_DATA382',
      `Scene Dialogue Audio take does not belong to this dialogue: ${input.takeId}.`
    );
  }
  session.db
    .update(sceneDialogueAudio)
    .set({ pickedTakeId: input.takeId, updatedAt: input.updatedAt })
    .where(eq(sceneDialogueAudio.id, input.sceneDialogueAudioId))
    .run();
}

export function deleteSceneDialogueAudioTakeRecord(
  session: DatabaseSession,
  input: { sceneDialogueAudioId: string; takeId: string; updatedAt: string }
): void {
  const audio = requireSceneDialogueAudioRecordById(
    session,
    input.sceneDialogueAudioId
  );
  const take = readSceneDialogueAudioTakeRecord(session, input);
  if (!take) {
    throw new ProjectDataError(
      'PROJECT_DATA382',
      `Scene Dialogue Audio take does not belong to this dialogue: ${input.takeId}.`
    );
  }
  session.db
    .delete(sceneDialogueAudioTakes)
    .where(eq(sceneDialogueAudioTakes.id, input.takeId))
    .run();
  if (audio.pickedTakeId !== input.takeId) {
    return;
  }
  const promoted = listSceneDialogueAudioTakeRecords(
    session,
    input.sceneDialogueAudioId
  )[0];
  session.db
    .update(sceneDialogueAudio)
    .set({
      pickedTakeId: promoted?.id ?? null,
      updatedAt: input.updatedAt,
    })
    .where(eq(sceneDialogueAudio.id, input.sceneDialogueAudioId))
    .run();
}

export function toSceneDialogueAudio(
  record: SceneDialogueAudioRecord,
  takes: SceneDialogueAudioTakeRecord[]
): SceneDialogueAudio {
  return {
    id: record.id,
    sceneId: record.sceneId,
    dialogueId: record.dialogueId,
    castMemberId: record.castMemberId,
    castVoiceId: record.castVoiceId,
    modelChoice: record.modelChoice as SceneDialogueAudioModelChoice,
    plainText: record.plainText,
    v3Text: record.v3Text,
    voiceSettings: parseVoiceSettings(record.voiceSettingsJson),
    outputFormat: record.outputFormat,
    languageCode: record.languageCode,
    pickedTakeId: record.pickedTakeId,
    takes: takes.map((take) =>
      toSceneDialogueAudioTake(take, take.id === record.pickedTakeId)
    ),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function toSceneDialogueAudioTake(
  record: SceneDialogueAudioTakeRecord,
  picked: boolean
): SceneDialogueAudioTake {
  return {
    takeId: record.id,
    sceneDialogueAudioId: record.sceneDialogueAudioId,
    assetId: record.assetId,
    assetFileId: record.assetFileId,
    mediaGenerationRunId: record.mediaGenerationRunId,
    modelChoice: record.modelChoice as SceneDialogueAudioModelChoice,
    castVoiceId: record.castVoiceId,
    castVoiceName: record.castVoiceName,
    provider: 'elevenlabs',
    providerVoiceId: record.providerVoiceId,
    providerTextSnapshot: record.providerTextSnapshot,
    plainTextSnapshot: record.plainTextSnapshot,
    v3TextSnapshot: record.v3TextSnapshot,
    textTreatment: record.textTreatment as SceneDialogueAudioTextTreatment,
    voiceSettingsSnapshot: parseVoiceSettings(record.voiceSettingsSnapshotJson),
    outputFormat: record.outputFormat,
    languageCode: record.languageCode,
    picked,
    createdAt: record.createdAt,
  };
}

function parseVoiceSettings(input: string): SceneDialogueAudioVoiceSettings {
  const parsed = JSON.parse(input) as SceneDialogueAudioVoiceSettings;
  return parsed && typeof parsed === 'object' ? parsed : {};
}
