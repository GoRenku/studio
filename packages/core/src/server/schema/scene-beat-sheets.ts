import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { assetFiles, assets } from './assets.js';
import { discardLifecycleColumns } from './lifecycle-columns.js';
import { scenes } from './scenes.js';

export const sceneBeatSheets = sqliteTable(
  'scene_beat_sheet',
  {
    id: text('id').primaryKey(),
    sceneId: text('scene_id')
      .notNull()
      .references(() => scenes.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    document: text('document').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('scene_beat_sheet_scene_updated_idx').on(
      table.sceneId,
      table.updatedAt,
      table.id
    ),
  ],
);

export const sceneBeatSheetState = sqliteTable('scene_beat_sheet_state', {
  sceneId: text('scene_id')
    .primaryKey()
    .references(() => scenes.id, { onDelete: 'cascade' }),
  activeBeatSheetId: text('active_beat_sheet_id').references(
    () => sceneBeatSheets.id,
    { onDelete: 'set null' }
  ),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const sceneBeatStoryboardImages = sqliteTable(
  'scene_beat_storyboard_image',
  {
    id: text('id').primaryKey(),
    sceneId: text('scene_id')
      .notNull()
      .references(() => scenes.id, { onDelete: 'cascade' }),
    beatSheetId: text('beat_sheet_id')
      .notNull()
      .references(() => sceneBeatSheets.id, { onDelete: 'cascade' }),
    beatId: text('beat_id').notNull(),
    assetId: text('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    assetFileId: text('asset_file_id')
      .notNull()
      .references(() => assetFiles.id),
    sourcePurpose: text('source_purpose').notNull(),
    beatContentFingerprint: text('beat_content_fingerprint').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    ...discardLifecycleColumns(),
  },
  (table) => [
    index('scene_beat_storyboard_image_scene_idx').on(table.sceneId),
    index('scene_beat_storyboard_image_beat_sheet_idx').on(
      table.beatSheetId,
      table.beatId,
      table.createdAt,
      table.id
    ),
    index('scene_beat_storyboard_image_asset_idx').on(table.assetId),
  ],
);
