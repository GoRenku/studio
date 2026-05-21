import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sequences } from './sequences.js';

export const scenes = sqliteTable(
  'scene',
  {
    id: text('id').primaryKey(),
    sequenceId: text('sequence_id')
      .notNull()
      .references(() => sequences.id),
    title: text('title').notNull(),
    interiorExterior: text('interior_exterior'),
    timeOfDay: text('time_of_day'),
    storyFunction: text('story_function'),
    blocksJson: text('blocks_json').notNull().default('[]'),
    position: integer('position').notNull(),
  },
  (table) => [
    index('scene_sequence_position_id_idx').on(
      table.sequenceId,
      table.position,
      table.id,
    ),
  ],
);
