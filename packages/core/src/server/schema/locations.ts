import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const locations = sqliteTable(
  'location',
  {
    id: text('id').primaryKey(),
    handle: text('handle').notNull(),
    name: text('name').notNull(),
    timePeriod: text('time_period'),
    description: text('description'),
    visualNotes: text('visual_notes'),
    position: integer('position').notNull(),
  },
  (table) => [
    index('location_position_id_idx').on(table.position, table.id),
    uniqueIndex('location_handle_idx').on(table.handle),
  ],
);
