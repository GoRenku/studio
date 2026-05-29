import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const screenplayAnalysis = sqliteTable(
  'screenplay_analysis',
  {
    id: text('id').primaryKey(),
    structureModel: text('structure_model').notNull(),
    document: text('document').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('screenplay_analysis_updated_at_id_idx').on(
      table.updatedAt,
      table.id
    ),
  ]
);

export const screenplayAnalysisState = sqliteTable('screenplay_analysis_state', {
  id: text('id').primaryKey(),
  activeAnalysisId: text('active_analysis_id').references(
    () => screenplayAnalysis.id,
    { onDelete: 'set null' }
  ),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
