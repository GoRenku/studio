import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { castMembers } from './cast-members.js';
import { scenes } from './scenes.js';

export const blocks = sqliteTable(
  'block',
  {
    id: text('id').primaryKey(),
    sceneId: text('scene_id')
      .notNull()
      .references(() => scenes.id),
    type: text('type').notNull(),
    text: text('text'),
    castId: text('cast_id').references(() => castMembers.id),
    extension: text('extension'),
    parenthetical: text('parenthetical'),
    lines: text('lines'),
    render: integer('render'),
    position: integer('position').notNull(),
  },
  (table) => [
    index('block_scene_position_id_idx').on(
      table.sceneId,
      table.position,
      table.id,
    ),
  ],
);
