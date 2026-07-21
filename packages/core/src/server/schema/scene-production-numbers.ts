import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const sceneProductionNumbers = sqliteTable('scene_production_number', {
  productionNumber: text('production_number').primaryKey(),
  sceneId: text('scene_id').notNull().unique(),
});
