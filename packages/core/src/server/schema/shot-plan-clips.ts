import { integer, sqliteTable, text, uniqueIndex, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { assets, assetFiles } from './assets.js';
import { shotPlanPrevisRevisions } from './shot-plan-previs.js';

export const shotPlanClips = sqliteTable('shot_plan_clip', {
  id: text('id').primaryKey(),
  previsRevisionId: text('previs_revision_id').notNull().references(() => shotPlanPrevisRevisions.id),
  number: integer('number').notNull(),
  selectedTakeId: text('selected_take_id').references((): AnySQLiteColumn => shotPlanClipTakes.id),
  createdAt: text('created_at').notNull(),
}, (table) => [uniqueIndex('shot_plan_clip_number_idx').on(table.previsRevisionId, table.number)]);

export const shotPlanClipTakes = sqliteTable('shot_plan_clip_take', {
  id: text('id').primaryKey(),
  clipId: text('clip_id').notNull().references(() => shotPlanClips.id),
  number: integer('number').notNull(),
  title: text('title'),
  assetId: text('asset_id').notNull().references(() => assets.id),
  assetFileId: text('asset_file_id').notNull().references(() => assetFiles.id),
  sourceTakeId: text('source_take_id').references((): AnySQLiteColumn => shotPlanClipTakes.id),
  createdAt: text('created_at').notNull(),
}, (table) => [
  uniqueIndex('shot_plan_clip_take_number_idx').on(table.clipId, table.number),
  uniqueIndex('shot_plan_clip_take_file_idx').on(table.assetFileId),
]);
