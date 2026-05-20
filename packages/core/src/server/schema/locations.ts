import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const locations = sqliteTable(
  'location',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    timePeriod: text('time_period'),
    description: text('description'),
    visualNotes: text('visual_notes'),
    position: integer('position').notNull(),
  },
  (table) => [index('location_position_id_idx').on(table.position, table.id)],
);
