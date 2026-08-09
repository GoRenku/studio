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

export const shotPlans = sqliteTable(
  'shot_plan',
  {
    id: text('id').primaryKey(),
    sceneId: text('scene_id').notNull(),
    number: integer('number').notNull(),
    title: text('title').notNull(),
    coverage: text('coverage'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    ...discardLifecycleColumns(),
  },
  (table) => [
    index('shot_plan_scene_active_created_idx').on(
      table.sceneId,
      table.discardedAt,
      table.createdAt,
      table.id
    ),
    uniqueIndex('shot_plan_scene_number_unique_idx').on(
      table.sceneId,
      table.number
    ),
    check('shot_plan_number_positive_check', sql`${table.number} > 0`),
  ]
);

export const sceneShotPlanNumbers = sqliteTable(
  'scene_shot_plan_number',
  {
    sceneId: text('scene_id').primaryKey(),
    lastNumber: integer('last_number').notNull(),
  },
  (table) => [
    check('scene_shot_plan_last_number_non_negative_check', sql`${table.lastNumber} >= 0`),
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
    number: text('number').notNull(),
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

export const shotNumberReservations = sqliteTable(
  'shot_number_reservation',
  {
    shotPlanId: text('shot_plan_id')
      .notNull()
      .references(() => shotPlans.id, { onDelete: 'cascade' }),
    number: text('number').notNull(),
    numberKey: text('number_key').notNull(),
    shotId: text('shot_id').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('shot_number_reservation_scope_number_unique_idx').on(
      table.shotPlanId,
      table.numberKey
    ),
    uniqueIndex('shot_number_reservation_scope_shot_unique_idx').on(
      table.shotPlanId,
      table.shotId
    ),
  ]
);
