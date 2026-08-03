import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { scenes } from './scenes.js';
import { screenplaySections } from './sections.js';

export const screenplayStructureEntries = sqliteTable(
  'screenplay_structure_entry',
  {
    id: text('id').primaryKey(),
    parentSectionId: text('parent_section_id').references(
      () => screenplaySections.id,
    ),
    contentType: text('content_type').notNull(),
    sceneId: text('scene_id').references(() => scenes.id, {
      onDelete: 'cascade',
    }),
    sectionId: text('section_id').references(() => screenplaySections.id),
    position: integer('position').notNull(),
  },
  (table) => [
    uniqueIndex('screenplay_structure_scene_unique_idx')
      .on(table.sceneId)
      .where(sql`${table.sceneId} is not null`),
    uniqueIndex('screenplay_structure_section_unique_idx')
      .on(table.sectionId)
      .where(sql`${table.sectionId} is not null`),
    uniqueIndex('screenplay_structure_root_position_unique_idx')
      .on(table.position)
      .where(sql`${table.parentSectionId} is null`),
    uniqueIndex('screenplay_structure_parent_position_unique_idx')
      .on(table.parentSectionId, table.position)
      .where(sql`${table.parentSectionId} is not null`),
    index('screenplay_structure_parent_position_idx').on(
      table.parentSectionId,
      table.position,
      table.id,
    ),
    check(
      'screenplay_structure_content_check',
      sql`(${table.contentType} = 'scene' and ${table.sceneId} is not null and ${table.sectionId} is null) or (${table.contentType} = 'section' and ${table.sceneId} is null and ${table.sectionId} is not null)`,
    ),
    check(
      'screenplay_structure_position_non_negative_check',
      sql`${table.position} >= 0`,
    ),
  ],
);
