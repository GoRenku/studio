import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { assetFiles, assets } from './assets.js';
import { discardLifecycleColumns } from './lifecycle-columns.js';
import { shotPlans } from './shot-plans.js';

export const shotPlanDialogueAudioTakes = sqliteTable(
  'shot_plan_dialogue_audio_take',
  {
    id: text('id').primaryKey(),
    shotPlanId: text('shot_plan_id')
      .notNull()
      .references(() => shotPlans.id),
    assetId: text('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    assetFileId: text('asset_file_id')
      .notNull()
      .references(() => assetFiles.id),
    turnStartNumber: integer('turn_start_number').notNull(),
    turnEndNumber: integer('turn_end_number').notNull(),
    selectedAt: text('selected_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    ...discardLifecycleColumns(),
  },
  (table) => [
    index('shot_plan_dialogue_audio_take_plan_idx').on(
      table.shotPlanId,
      table.createdAt,
      table.id,
    ),
    uniqueIndex('shot_plan_dialogue_audio_take_asset_idx').on(table.assetId),
    check('shot_plan_dialogue_audio_take_start_positive', sql`${table.turnStartNumber} > 0`),
    check('shot_plan_dialogue_audio_take_range_ascending', sql`${table.turnEndNumber} >= ${table.turnStartNumber}`),
  ],
);
