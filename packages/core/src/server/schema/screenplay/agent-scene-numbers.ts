import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const agentSceneNumberReservations = sqliteTable(
  'agent_scene_number_reservation',
  {
    number: text('number').notNull(),
    numberKey: text('number_key').notNull(),
    sceneId: text('scene_id').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('agent_scene_number_key_unique_idx').on(table.numberKey),
    uniqueIndex('agent_scene_number_scene_unique_idx').on(table.sceneId),
  ]
);
