import { index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { assetFiles, assets } from './assets.js';
import { castMembers } from './cast-members.js';
import { castVoices } from './cast-voices.js';
import { discardLifecycleColumns } from './lifecycle-columns.js';
import { scenes } from './scenes.js';

export const sceneDialogueAudio = sqliteTable(
  'scene_dialogue_audio',
  {
    id: text('id').primaryKey(),
    sceneId: text('scene_id')
      .notNull()
      .references(() => scenes.id, { onDelete: 'cascade' }),
    dialogueId: text('dialogue_id').notNull(),
    castMemberId: text('cast_member_id')
      .notNull()
      .references(() => castMembers.id),
    castVoiceId: text('cast_voice_id').references(() => castVoices.id),
    modelChoice: text('model_choice').notNull(),
    plainText: text('plain_text').notNull(),
    v3Text: text('v3_text').notNull(),
    voiceSettingsJson: text('voice_settings_json').notNull(),
    outputFormat: text('output_format').notNull(),
    languageCode: text('language_code'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('scene_dialogue_audio_scene_idx').on(
      table.sceneId,
      table.updatedAt,
      table.id
    ),
    uniqueIndex('scene_dialogue_audio_dialogue_idx').on(
      table.sceneId,
      table.dialogueId
    ),
    index('scene_dialogue_audio_cast_member_idx').on(table.castMemberId),
    index('scene_dialogue_audio_cast_voice_idx').on(table.castVoiceId),
  ]
);

export const sceneDialogueAudioTakes = sqliteTable(
  'scene_dialogue_audio_take',
  {
    id: text('id').primaryKey(),
    sceneDialogueAudioId: text('scene_dialogue_audio_id')
      .notNull()
      .references(() => sceneDialogueAudio.id, { onDelete: 'cascade' }),
    assetId: text('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    assetFileId: text('asset_file_id')
      .notNull()
      .references(() => assetFiles.id),
    modelChoice: text('model_choice').notNull(),
    castVoiceId: text('cast_voice_id')
      .notNull()
      .references(() => castVoices.id),
    castVoiceName: text('cast_voice_name').notNull(),
    provider: text('provider').notNull(),
    providerVoiceId: text('provider_voice_id').notNull(),
    providerTextSnapshot: text('provider_text_snapshot').notNull(),
    plainTextSnapshot: text('plain_text_snapshot').notNull(),
    v3TextSnapshot: text('v3_text_snapshot').notNull(),
    textTreatment: text('text_treatment').notNull(),
    voiceSettingsSnapshotJson: text('voice_settings_snapshot_json').notNull(),
    outputFormat: text('output_format').notNull(),
    languageCode: text('language_code'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    ...discardLifecycleColumns(),
  },
  (table) => [
    index('scene_dialogue_audio_take_audio_idx').on(
      table.sceneDialogueAudioId,
      table.createdAt,
      table.id
    ),
    uniqueIndex('scene_dialogue_audio_take_asset_idx').on(table.assetId),
  ]
);
