import { sql } from 'drizzle-orm';
import { check, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const screenplaySections = sqliteTable(
  'screenplay_section',
  {
    id: text('id').primaryKey(),
    sectionType: text('section_type').notNull(),
    title: text('title').notNull(),
    description: text('description'),
  },
  (table) => [
    check(
      'screenplay_section_type_check',
      sql`${table.sectionType} in ('act', 'sequence')`,
    ),
    check(
      'screenplay_section_title_non_empty_check',
      sql`length(${table.title}) > 0`,
    ),
  ],
);
