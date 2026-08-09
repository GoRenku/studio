import { sql } from 'drizzle-orm';
import {
  check,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

export const scenes = sqliteTable(
  'scene',
  {
    id: text('id').primaryKey(),
    productionNumber: text('production_number'),
    heading: text('heading').notNull(),
    title: text('title'),
    blocksJson: text('blocks_json').notNull().default('[]'),
  },
  (table) => [
    check('scene_heading_non_empty_check', sql`length(${table.heading}) > 0`),
  ],
);
