import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { assetFiles, assets } from './assets.js';
import { discardLifecycleColumns } from './lifecycle-columns.js';
import { sceneShotLists } from './scene-shot-lists.js';
import { scenes } from './scenes.js';

export const sceneShotReferenceAssets = sqliteTable(
  'scene_shot_reference_asset',
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
    sortOrder: integer('sort_order').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    ...discardLifecycleColumns(),
  },
  (table) => [
    uniqueIndex('scene_shot_reference_asset_slot_idx').on(
      table.shotListId,
      table.shotId,
      table.assetFileId
    ),
    index('scene_shot_reference_asset_scene_idx').on(table.sceneId),
    index('scene_shot_reference_asset_shot_idx').on(
      table.shotListId,
      table.shotId,
      table.sortOrder
    ),
    index('scene_shot_reference_asset_asset_idx').on(table.assetId),
  ],
);
