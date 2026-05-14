import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const continuityReferences = sqliteTable(
  'continuity_reference',
  {
    id: text('id').primaryKey(),
    kind: text('kind').notNull(),
    name: text('name').notNull(),
    oneLineSummary: text('one_line_summary'),
    position: integer('position').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('continuity_reference_position_id_idx').on(table.position, table.id),
  ]
);
