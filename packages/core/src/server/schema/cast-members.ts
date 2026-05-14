import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const castMembers = sqliteTable(
  'cast_member',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    kind: text('kind'),
    role: text('role'),
    shortDescription: text('short_description'),
    position: integer('position').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('cast_member_position_id_idx').on(table.position, table.id)]
);
