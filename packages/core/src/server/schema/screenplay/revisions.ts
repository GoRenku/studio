import { sql } from 'drizzle-orm';
import { check, index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const screenplayRevisions = sqliteTable(
  'screenplay_revision',
  {
    id: text('id').primaryKey(),
    screenplayJson: text('screenplay_json').notNull(),
    sourceCommand: text('source_command').notNull(),
    summary: text('summary'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('screenplay_revision_created_idx').on(table.createdAt, table.id),
    check('screenplay_revision_source_non_empty_check', sql`length(${table.sourceCommand}) > 0`),
  ],
);
