import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { castMembers } from '../cast-members.js';
import { locations } from '../locations.js';
import { props } from '../props.js';
import { scenes } from './scenes.js';

export const screenplayReferences = sqliteTable(
  'screenplay_reference',
  {
    id: text('id').primaryKey(),
    subjectType: text('subject_type').notNull(),
    castMemberId: text('cast_member_id').references(() => castMembers.id),
    locationId: text('location_id').references(() => locations.id),
    propId: text('prop_id').references(() => props.id),
    targetType: text('target_type').notNull(),
    openingElementId: text('opening_element_id'),
    sceneId: text('scene_id').references(() => scenes.id, {
      onDelete: 'cascade',
    }),
    blockId: text('block_id'),
    turnId: text('turn_id'),
    partId: text('part_id'),
    role: text('role').notNull(),
    rangeStart: integer('range_start'),
    rangeLength: integer('range_length'),
  },
  (table) => [
    index('screenplay_reference_scene_idx').on(table.sceneId, table.id),
    index('screenplay_reference_cast_idx').on(table.castMemberId, table.id),
    index('screenplay_reference_location_idx').on(table.locationId, table.id),
    index('screenplay_reference_prop_idx').on(table.propId, table.id),
    check(
      'screenplay_reference_subject_check',
      sql`(${table.subjectType} = 'castMember' and ${table.castMemberId} is not null and ${table.locationId} is null and ${table.propId} is null) or (${table.subjectType} = 'location' and ${table.castMemberId} is null and ${table.locationId} is not null and ${table.propId} is null) or (${table.subjectType} = 'prop' and ${table.castMemberId} is null and ${table.locationId} is null and ${table.propId} is not null)`,
    ),
    check(
      'screenplay_reference_target_check',
      sql`(${table.targetType} = 'openingElement' and ${table.openingElementId} is not null and ${table.sceneId} is null and ${table.blockId} is null and ${table.turnId} is null and ${table.partId} is null) or (${table.targetType} in ('scene', 'sceneHeading') and ${table.openingElementId} is null and ${table.sceneId} is not null and ${table.blockId} is null and ${table.turnId} is null and ${table.partId} is null) or (${table.targetType} = 'block' and ${table.openingElementId} is null and ${table.sceneId} is not null and ${table.blockId} is not null and ${table.turnId} is null and ${table.partId} is null) or (${table.targetType} = 'dialogueCue' and ${table.openingElementId} is null and ${table.sceneId} is not null and ${table.blockId} is null and ${table.turnId} is not null and ${table.partId} is null) or (${table.targetType} = 'dialoguePart' and ${table.openingElementId} is null and ${table.sceneId} is not null and ${table.blockId} is null and ${table.turnId} is not null and ${table.partId} is not null)`,
    ),
    check(
      'screenplay_reference_role_check',
      sql`${table.role} in ('speaker', 'setting', 'mention', 'presence')`,
    ),
    check(
      'screenplay_reference_range_check',
      sql`(${table.role} = 'mention' and ${table.rangeStart} is not null and ${table.rangeStart} >= 0 and ${table.rangeLength} is not null and ${table.rangeLength} > 0) or (${table.role} <> 'mention' and ${table.rangeStart} is null and ${table.rangeLength} is null)`,
    ),
  ],
);
