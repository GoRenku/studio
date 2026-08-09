import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const sceneBeatsRevisions = sqliteTable(
  'scene_beats_revision',
  {
    id: text('id').primaryKey(),
    sceneId: text('scene_id').notNull(),
    document: text('document').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('scene_beats_revision_scene_updated_idx').on(
      table.sceneId,
      table.updatedAt,
      table.id
    ),
  ],
);

export const sceneBeatsState = sqliteTable('scene_beats_state', {
  sceneId: text('scene_id').primaryKey(),
  activeRevisionId: text('active_revision_id').references(
    () => sceneBeatsRevisions.id,
    { onDelete: 'set null' }
  ),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
