import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { assetFiles, assets } from './assets.js';
import { discardLifecycleColumns } from './lifecycle-columns.js';
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

export const sceneShotStoryboardImages = sqliteTable(
  'scene_shot_storyboard_image',
  {
    id: text('id').primaryKey(),
    sceneId: text('scene_id')
      .notNull()
      .references(() => scenes.id, { onDelete: 'cascade' }),
    shotListId: text('shot_list_id')
      .notNull()
      .references(() => sceneShotLists.id, { onDelete: 'cascade' }),
    shotId: text('shot_id').notNull(),
    assetId: text('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    assetFileId: text('asset_file_id')
      .notNull()
      .references(() => assetFiles.id),
    sourcePurpose: text('source_purpose').notNull(),
    shotContentFingerprint: text('shot_content_fingerprint').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    ...discardLifecycleColumns(),
  },
  (table) => [
    index('scene_shot_storyboard_image_scene_idx').on(table.sceneId),
    index('scene_shot_storyboard_image_shot_list_idx').on(
      table.shotListId,
      table.shotId,
      table.createdAt,
      table.id
    ),
    index('scene_shot_storyboard_image_asset_idx').on(table.assetId),
  ],
);

export const sceneShotVideoTakes = sqliteTable(
  'scene_shot_video_take',
  {
    id: text('id').primaryKey(),
    sceneId: text('scene_id')
      .notNull()
      .references(() => scenes.id, { onDelete: 'cascade' }),
    sourceShotListId: text('source_shot_list_id')
      .notNull()
      .references(() => sceneShotLists.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    stateJson: text('state_json')
      .notNull()
      .default(
        '{"version":3,"structure":{"mode":"continuous","sharedDirection":{}}}'
      ),
    isPicked: integer('is_picked', { mode: 'boolean' })
      .notNull()
      .default(false),
    mediaFolderProjectRelativePath: text('media_folder_project_relative_path'),
    historySnapshot: text('history_snapshot_json').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    ...discardLifecycleColumns(),
  },
  (table) => [
    index('scene_shot_video_take_scene_idx').on(
      table.sceneId,
      table.updatedAt,
      table.id
    ),
    index('scene_shot_video_take_source_shot_list_idx').on(
      table.sourceShotListId,
      table.createdAt,
      table.id
    ),
  ],
);

export const sceneShotVideoTakeShots = sqliteTable(
  'scene_shot_video_take_shot',
  {
    takeId: text('take_id')
      .notNull()
      .references(() => sceneShotVideoTakes.id, {
        onDelete: 'cascade',
      }),
    shotId: text('shot_id').notNull(),
    shotOrder: integer('shot_order').notNull(),
    shotContentFingerprint: text('shot_content_fingerprint').notNull(),
    storyboardImageId: text('storyboard_image_id'),
    storyboardAssetFileId: text('storyboard_asset_file_id'),
    storyboardContentFingerprint: text(
      'storyboard_content_fingerprint'
    ).notNull(),
    ...discardLifecycleColumns(),
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

export const sceneShotVideoTakeVideos = sqliteTable(
  'scene_shot_video_take_video',
  {
    takeId: text('take_id')
      .notNull()
      .unique()
      .references(() => sceneShotVideoTakes.id, {
        onDelete: 'cascade',
      }),
    assetId: text('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    assetFileId: text('asset_file_id')
      .notNull()
      .references(() => assetFiles.id),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    ...discardLifecycleColumns(),
  },
  (table) => [
    index('scene_shot_video_take_video_take_idx').on(
      table.takeId,
      table.createdAt,
    ),
    index('scene_shot_video_take_video_asset_idx').on(table.assetId),
  ],
);

export const sceneShotVideoTakeImages = sqliteTable(
  'scene_shot_video_take_image',
  {
    takeId: text('take_id')
      .notNull()
      .references(() => sceneShotVideoTakes.id, { onDelete: 'cascade' }),
    role: text('role', {
      enum: ['first-frame', 'last-frame', 'video-prompt'],
    }).notNull(),
    assetId: text('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    assetFileId: text('asset_file_id')
      .notNull()
      .references(() => assetFiles.id),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    ...discardLifecycleColumns(),
  },
  (table) => [
    uniqueIndex('scene_shot_video_take_image_role_idx').on(
      table.takeId,
      table.role
    ),
    index('scene_shot_video_take_image_asset_idx').on(table.assetId),
  ],
);
