import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';
import { locations } from './locations.js';
import { scenes } from './scenes.js';

export const sceneLocations = sqliteTable(
  'scene_location',
  {
    sceneId: text('scene_id')
      .notNull()
      .references(() => scenes.id),
    locationId: text('location_id')
      .notNull()
      .references(() => locations.id),
    position: integer('position').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sceneId, table.locationId] }),
    index('scene_location_scene_position_idx').on(
      table.sceneId,
      table.position,
    ),
  ],
);
