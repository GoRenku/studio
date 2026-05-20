import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';
import { blocks } from './blocks.js';
import { castMembers } from './cast-members.js';

export const blockCastMembers = sqliteTable(
  'block_cast_member',
  {
    blockId: text('block_id')
      .notNull()
      .references(() => blocks.id),
    castMemberId: text('cast_member_id')
      .notNull()
      .references(() => castMembers.id),
    position: integer('position').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.blockId, table.castMemberId] }),
    index('block_cast_member_block_position_idx').on(
      table.blockId,
      table.position,
    ),
  ],
);
