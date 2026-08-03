import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const screenplay = sqliteTable(
  'screenplay',
  {
    singletonId: integer('singleton_id').primaryKey(),
    openingJson: text('opening_json').notNull().default('[]'),
  },
  (table) => [
    check('screenplay_singleton_check', sql`${table.singletonId} = 1`),
  ],
);
