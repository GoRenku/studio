import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { assetFiles, assets } from './assets.js';
import { scenes } from './scenes.js';

export const sceneShotLists = sqliteTable(
  'scene_shot_list',
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
    index('scene_shot_list_scene_updated_idx').on(
      table.sceneId,
      table.updatedAt,
      table.id
    ),
  ],
);

export const sceneShotListState = sqliteTable('scene_shot_list_state', {
  sceneId: text('scene_id')
    .primaryKey()
    .references(() => scenes.id, { onDelete: 'cascade' }),
  activeShotListId: text('active_shot_list_id').references(
    () => sceneShotLists.id,
    { onDelete: 'set null' }
  ),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const sceneShotStoryboardSheets = sqliteTable(
  'scene_shot_storyboard_sheet',
  {
    id: text('id').primaryKey(),
    shotListId: text('shot_list_id')
      .notNull()
      .references(() => sceneShotLists.id, { onDelete: 'cascade' }),
    assetId: text('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    sheetFileId: text('sheet_file_id')
      .notNull()
      .references(() => assetFiles.id),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('scene_shot_storyboard_sheet_asset_idx').on(table.assetId),
    index('scene_shot_storyboard_sheet_list_created_idx').on(
      table.shotListId,
      table.createdAt,
      table.id
    ),
  ],
);

export const sceneShotStoryboardImages = sqliteTable(
  'scene_shot_storyboard_image',
  {
    id: text('id').primaryKey(),
    storyboardSheetId: text('storyboard_sheet_id')
      .notNull()
      .references(() => sceneShotStoryboardSheets.id, { onDelete: 'cascade' }),
    shotId: text('shot_id').notNull(),
    assetFileId: text('asset_file_id')
      .notNull()
      .references(() => assetFiles.id),
    position: integer('position').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('scene_shot_storyboard_image_sheet_shot_idx').on(
      table.storyboardSheetId,
      table.shotId
    ),
    uniqueIndex('scene_shot_storyboard_image_file_idx').on(table.assetFileId),
    index('scene_shot_storyboard_image_order_idx').on(
      table.storyboardSheetId,
      table.position,
      table.id
    ),
  ],
);
