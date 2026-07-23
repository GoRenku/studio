import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { assets } from './assets.js';
import { discardLifecycleColumns } from './lifecycle-columns.js';
import { mediaGenerationSpecs } from './media-generation.js';

export const shotPlans = sqliteTable(
  'shot_plan',
  {
    id: text('id').primaryKey(),
    sceneId: text('scene_id').notNull(),
    title: text('title').notNull(),
    coverage: text('coverage'),
    generationSpecId: text('generation_spec_id').references(
      () => mediaGenerationSpecs.id
    ),
    videoAssetId: text('video_asset_id').references(() => assets.id),
    videoAttachedAt: text('video_attached_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    ...discardLifecycleColumns(),
  },
  (table) => [
    uniqueIndex('shot_plan_generation_spec_unique_idx').on(
      table.generationSpecId
    ),
    uniqueIndex('shot_plan_video_asset_unique_idx').on(table.videoAssetId),
    index('shot_plan_scene_active_created_idx').on(
      table.sceneId,
      table.discardedAt,
      table.createdAt,
      table.id
    ),
    check(
      'shot_plan_video_attachment_pair_check',
      sql`(${table.videoAssetId} is null and ${table.videoAttachedAt} is null) or (${table.videoAssetId} is not null and ${table.videoAttachedAt} is not null)`
    ),
  ]
);

export const shots = sqliteTable(
  'shot',
  {
    id: text('id').primaryKey(),
    shotPlanId: text('shot_plan_id')
      .notNull()
      .references(() => shotPlans.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    description: text('description').notNull(),
    brief: text('brief').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('shot_plan_position_unique_idx').on(
      table.shotPlanId,
      table.position
    ),
    index('shot_plan_id_idx').on(table.shotPlanId, table.id),
    check('shot_position_non_negative_check', sql`${table.position} >= 0`),
  ]
);
