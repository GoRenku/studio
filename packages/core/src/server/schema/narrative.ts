import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const episodes = sqliteTable(
  'episode',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    shortTitle: text('short_title'),
    episodeNumber: integer('episode_number'),
    oneLineSummary: text('one_line_summary'),
    position: integer('position').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('episode_position_id_idx').on(table.position, table.id)]
);

export const sequences = sqliteTable(
  'sequence',
  {
    id: text('id').primaryKey(),
    episodeId: text('episode_id').references(() => episodes.id),
    title: text('title').notNull(),
    shortTitle: text('short_title'),
    oneLineSummary: text('one_line_summary'),
    position: integer('position').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('sequence_episode_position_id_idx').on(
      table.episodeId,
      table.position,
      table.id
    ),
  ]
);

export const scenes = sqliteTable(
  'scene',
  {
    id: text('id').primaryKey(),
    sequenceId: text('sequence_id')
      .notNull()
      .references(() => sequences.id),
    title: text('title').notNull(),
    oneLineSummary: text('one_line_summary'),
    position: integer('position').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('scene_sequence_position_id_idx').on(
      table.sequenceId,
      table.position,
      table.id
    ),
  ]
);

export const clips = sqliteTable(
  'clip',
  {
    id: text('id').primaryKey(),
    sceneId: text('scene_id')
      .notNull()
      .references(() => scenes.id),
    title: text('title').notNull(),
    oneLineSummary: text('one_line_summary'),
    position: integer('position').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('clip_scene_position_id_idx').on(table.sceneId, table.position, table.id),
  ]
);
