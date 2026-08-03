import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { scenes } from './screenplay/scenes.js';

export const sceneBeatSheets = sqliteTable(
  'scene_beat_sheet',
  {
    id: text('id').primaryKey(),
    sceneId: text('scene_id')
      .notNull()
      .references(() => scenes.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    document: text('document').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('scene_beat_sheet_scene_updated_idx').on(
      table.sceneId,
      table.updatedAt,
      table.id
    ),
  ],
);

export const sceneBeatSheetState = sqliteTable('scene_beat_sheet_state', {
  sceneId: text('scene_id')
    .primaryKey()
    .references(() => scenes.id, { onDelete: 'cascade' }),
  activeBeatSheetId: text('active_beat_sheet_id').references(
    () => sceneBeatSheets.id,
    { onDelete: 'set null' }
  ),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
