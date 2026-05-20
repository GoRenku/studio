import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';
import { blocks } from './blocks.js';
import { locations } from './locations.js';

export const blockLocations = sqliteTable(
  'block_location',
  {
    blockId: text('block_id')
      .notNull()
      .references(() => blocks.id),
    locationId: text('location_id')
      .notNull()
      .references(() => locations.id),
    position: integer('position').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.blockId, table.locationId] }),
    index('block_location_block_position_idx').on(
      table.blockId,
      table.position,
    ),
  ],
);
