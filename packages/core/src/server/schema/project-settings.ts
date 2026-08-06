import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const projectSettings = sqliteTable(
  'project_settings',
  {
    singletonId: integer('singleton_id').primaryKey(),
    document: text('document').notNull(),
  },
  (table) => [
    check('project_settings_singleton_id_check', sql`${table.singletonId} = 1`),
  ]
);
