import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const castMembers = sqliteTable(
  'cast_member',
  {
    id: text('id').primaryKey(),
    handle: text('handle').notNull(),
    name: text('name').notNull(),
    role: text('role'),
    age: integer('age'),
    want: text('want'),
    need: text('need'),
    arc: text('arc'),
    voiceNotes: text('voice_notes'),
    description: text('description'),
    position: integer('position').notNull(),
  },
  (table) => [
    index('cast_member_position_id_idx').on(table.position, table.id),
    uniqueIndex('cast_member_handle_idx').on(table.handle),
  ],
);
