import { sql } from 'drizzle-orm';
import {
  check,
  sqliteTable,
  text,
  uniqueIndex,
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
    uniqueIndex('scene_production_number_unique_idx')
      .on(table.productionNumber)
      .where(sql`${table.productionNumber} is not null`),
    check('scene_heading_non_empty_check', sql`length(${table.heading}) > 0`),
    check(
      'scene_production_number_non_empty_check',
      sql`${table.productionNumber} is null or length(${table.productionNumber}) > 0`,
    ),
  ],
);
