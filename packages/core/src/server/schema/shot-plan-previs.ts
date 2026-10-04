import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { assetFiles } from './asset-files.js';
import { shotPlans } from './shot-plans.js';

export const shotPlanPrevisRevisions = sqliteTable('shot_plan_previs_revision', {
  id: text('id').primaryKey(),
  shotPlanId: text('shot_plan_id').notNull().references(() => shotPlans.id),
  number: integer('number').notNull(),
  sourceDirectory: text('source_directory').notNull(),
  sourceHash: text('source_hash').notNull(),
  renderHash: text('render_hash').notNull(),
  assetFileId: text('asset_file_id').notNull().references(() => assetFiles.id),
  createdAt: text('created_at').notNull(),
}, (table) => [
  uniqueIndex('shot_plan_previs_number_idx').on(table.shotPlanId, table.number),
  uniqueIndex('shot_plan_previs_content_idx').on(table.shotPlanId, table.sourceHash, table.renderHash),
]);
