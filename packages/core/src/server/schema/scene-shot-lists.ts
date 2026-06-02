import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { assetFiles, assets } from './assets.js';
import { mediaGenerationRuns } from './media-generation.js';
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

export const sceneShotVideoTakeInputs = sqliteTable(
  'scene_shot_video_take_input',
  {
    id: text('id').primaryKey(),
    sceneId: text('scene_id')
      .notNull()
      .references(() => scenes.id, { onDelete: 'cascade' }),
    shotListId: text('shot_list_id')
      .notNull()
      .references(() => sceneShotLists.id, { onDelete: 'cascade' }),
    productionGroupId: text('production_group_id').notNull(),
    inputKind: text('input_kind').notNull(),
    subjectKind: text('subject_kind').notNull(),
    subjectId: text('subject_id').notNull(),
    assetId: text('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    assetFileId: text('asset_file_id')
      .notNull()
      .references(() => assetFiles.id),
    mediaGenerationRunId: text('media_generation_run_id').references(
      () => mediaGenerationRuns.id,
      { onDelete: 'set null' }
    ),
    selection: text('selection').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('scene_shot_video_take_input_group_idx').on(
      table.sceneId,
      table.shotListId,
      table.productionGroupId,
      table.createdAt,
      table.id
    ),
    index('scene_shot_video_take_input_asset_idx').on(table.assetId),
    uniqueIndex('scene_shot_video_take_input_selected_idx')
      .on(
        table.sceneId,
        table.shotListId,
        table.productionGroupId,
        table.inputKind,
        table.subjectKind,
        table.subjectId
      )
      .where(sql`${table.selection} = 'select'`),
  ],
);

export const sceneShotVideoTakeInputShots = sqliteTable(
  'scene_shot_video_take_input_shot',
  {
    inputId: text('input_id')
      .notNull()
      .references(() => sceneShotVideoTakeInputs.id, { onDelete: 'cascade' }),
    shotId: text('shot_id').notNull(),
    shotOrder: integer('shot_order').notNull(),
  },
  (table) => [
    uniqueIndex('scene_shot_video_take_input_shot_idx').on(
      table.inputId,
      table.shotId
    ),
    index('scene_shot_video_take_input_shot_order_idx').on(
      table.inputId,
      table.shotOrder
    ),
  ],
);

export const sceneShotVideoTakes = sqliteTable(
  'scene_shot_video_take',
  {
    id: text('id').primaryKey(),
    sceneId: text('scene_id')
      .notNull()
      .references(() => scenes.id, { onDelete: 'cascade' }),
    shotListId: text('shot_list_id')
      .notNull()
      .references(() => sceneShotLists.id, { onDelete: 'cascade' }),
    productionGroupId: text('production_group_id').notNull(),
    assetId: text('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    assetFileId: text('asset_file_id')
      .notNull()
      .references(() => assetFiles.id),
    mediaGenerationRunId: text('media_generation_run_id').references(
      () => mediaGenerationRuns.id,
      { onDelete: 'set null' }
    ),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    isSelected: integer('is_selected', { mode: 'boolean' }).notNull(),
  },
  (table) => [
    index('scene_shot_video_take_group_idx').on(
      table.sceneId,
      table.shotListId,
      table.productionGroupId,
      table.createdAt,
      table.id
    ),
    index('scene_shot_video_take_asset_idx').on(table.assetId),
    uniqueIndex('scene_shot_video_take_selected_idx')
      .on(table.sceneId, table.shotListId, table.productionGroupId)
      .where(sql`${table.isSelected} = 1`),
  ],
);

export const sceneShotVideoTakeShots = sqliteTable(
  'scene_shot_video_take_shot',
  {
    takeId: text('take_id')
      .notNull()
      .references(() => sceneShotVideoTakes.id, { onDelete: 'cascade' }),
    shotId: text('shot_id').notNull(),
    shotOrder: integer('shot_order').notNull(),
  },
  (table) => [
    uniqueIndex('scene_shot_video_take_shot_idx').on(
      table.takeId,
      table.shotId
    ),
    index('scene_shot_video_take_shot_order_idx').on(
      table.takeId,
      table.shotOrder
    ),
  ],
);
