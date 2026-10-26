import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { assetFiles } from './asset-files.js';
import { castMembers } from './cast-members.js';
import { scenes } from './screenplay/index.js';

export const castLooks = sqliteTable(
  'cast_look',
  {
    id: text('id').primaryKey(),
    castMemberId: text('cast_member_id')
      .notNull()
      .references(() => castMembers.id),
    name: text('name').notNull(),
    description: text('description'),
    position: integer('position').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('cast_look_member_name_idx').on(table.castMemberId, table.name),
    index('cast_look_member_position_idx').on(table.castMemberId, table.position),
  ],
);

export const castLookScenes = sqliteTable(
  'cast_look_scene',
  {
    castMemberId: text('cast_member_id')
      .notNull()
      .references(() => castMembers.id),
    castLookId: text('cast_look_id')
      .notNull()
      .references(() => castLooks.id),
    sceneId: text('scene_id')
      .notNull()
      .references(() => scenes.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('cast_look_scene_member_scene_idx').on(table.castMemberId, table.sceneId),
    index('cast_look_scene_look_idx').on(table.castLookId),
  ],
);

export const castCostumes = sqliteTable(
  'cast_costume',
  {
    id: text('id').primaryKey(),
    castMemberId: text('cast_member_id')
      .notNull()
      .references(() => castMembers.id),
    castLookId: text('cast_look_id')
      .notNull()
      .references(() => castLooks.id),
    name: text('name').notNull(),
    wardrobeJson: text('wardrobe_json').notNull(),
    continuityNotesJson: text('continuity_notes_json').notNull(),
    position: integer('position').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('cast_costume_member_name_idx').on(table.castMemberId, table.name),
    index('cast_costume_look_position_idx').on(table.castLookId, table.position),
  ],
);

export const castCostumeScenes = sqliteTable(
  'cast_costume_scene',
  {
    castMemberId: text('cast_member_id')
      .notNull()
      .references(() => castMembers.id),
    castCostumeId: text('cast_costume_id')
      .notNull()
      .references(() => castCostumes.id),
    sceneId: text('scene_id')
      .notNull()
      .references(() => scenes.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('cast_costume_scene_member_scene_idx').on(table.castMemberId, table.sceneId),
    index('cast_costume_scene_costume_idx').on(table.castCostumeId),
  ],
);

/** A round belongs to exactly one subject: a Look (casting candidates) or a costume (character sheets). */
export const castingRounds = sqliteTable(
  'casting_round',
  {
    id: text('id').primaryKey(),
    castLookId: text('cast_look_id').references(() => castLooks.id),
    castCostumeId: text('cast_costume_id').references(() => castCostumes.id),
    number: integer('number').notNull(),
    routesJson: text('routes_json').notNull(),
    maxConcurrentGenerations: integer('max_concurrent_generations').notNull(),
    referenceAssetFileIdsJson: text('reference_asset_file_ids_json').notNull(),
    estimatedCostJson: text('estimated_cost_json'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    check('casting_round_one_subject_check', sql`(${table.castLookId} is null) <> (${table.castCostumeId} is null)`),
    uniqueIndex('casting_round_look_number_idx')
      .on(table.castLookId, table.number)
      .where(sql`${table.castLookId} is not null`),
    uniqueIndex('casting_round_costume_number_idx')
      .on(table.castCostumeId, table.number)
      .where(sql`${table.castCostumeId} is not null`),
  ],
);

export const castingCandidates = sqliteTable(
  'casting_candidate',
  {
    assetFileId: text('asset_file_id')
      .primaryKey()
      .references(() => assetFiles.id, { onDelete: 'cascade' }),
    castingRoundId: text('casting_round_id')
      .notNull()
      .references(() => castingRounds.id),
    status: text('status', { enum: ['candidate', 'hidden'] }).notNull(),
    /** The Skill model key of the round route that generated the candidate. */
    modelKey: text('model_key').notNull(),
  },
  (table) => [index('casting_candidate_round_idx').on(table.castingRoundId)],
);
