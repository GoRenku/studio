import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { acts } from './acts.js';

export const sequences = sqliteTable(
  'sequence',
  {
    id: text('id').primaryKey(),
    actId: text('act_id')
      .notNull()
      .references(() => acts.id),
    title: text('title').notNull(),
    purpose: text('purpose'),
    position: integer('position').notNull(),
  },
  (table) => [
    index('sequence_act_position_id_idx').on(
      table.actId,
      table.position,
      table.id,
    ),
  ],
);
