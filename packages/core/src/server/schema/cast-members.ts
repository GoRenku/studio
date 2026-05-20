import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const castMembers = sqliteTable(
  'cast_member',
  {
    id: text('id').primaryKey(),
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
  ],
);
