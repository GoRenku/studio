import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const props = sqliteTable(
  'prop',
  {
    id: text('id').primaryKey(),
    handle: text('handle').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    visualNotes: text('visual_notes'),
    position: integer('position').notNull(),
  },
  (table) => [
    index('prop_position_id_idx').on(table.position, table.id),
    uniqueIndex('prop_handle_idx').on(table.handle),
  ],
);
