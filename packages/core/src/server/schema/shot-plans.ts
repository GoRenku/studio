import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { discardLifecycleColumns } from './lifecycle-columns.js';
import { mediaGenerationSpecs } from './media-generation.js';

export const shotPlans = sqliteTable(
  'shot_plan',
  {
    id: text('id').primaryKey(),
    sceneId: text('scene_id').notNull(),
    title: text('title').notNull(),
    coverage: text('coverage'),
    lastGenerationSpecId: text('generation_spec_id').references(
      () => mediaGenerationSpecs.id
    ),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    ...discardLifecycleColumns(),
  },
  (table) => [
    uniqueIndex('shot_plan_last_generation_spec_unique_idx').on(
      table.lastGenerationSpecId
    ),
    index('shot_plan_scene_active_created_idx').on(
      table.sceneId,
      table.discardedAt,
      table.createdAt,
      table.id
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
    title: text('title').notNull(),
    description: text('description').notNull(),
    brief: text('brief').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    ...discardLifecycleColumns(),
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
