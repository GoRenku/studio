import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const acts = sqliteTable(
  'act',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    purpose: text('purpose'),
    position: integer('position').notNull(),
  },
  (table) => [index('act_position_id_idx').on(table.position, table.id)],
);
