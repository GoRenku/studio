import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { assets } from './assets.js';
import { castMembers } from './cast-members.js';
import { locations } from './locations.js';

export const castProfileDisplayAssets = sqliteTable('cast_profile_display_asset', {
  castMemberId: text('cast_member_id')
    .primaryKey()
    .references(() => castMembers.id, { onDelete: 'cascade' }),
  assetId: text('asset_id')
    .notNull()
    .references(() => assets.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const locationHeroDisplayAssets = sqliteTable('location_hero_display_asset', {
  locationId: text('location_id')
    .primaryKey()
    .references(() => locations.id, { onDelete: 'cascade' }),
  assetId: text('asset_id')
    .notNull()
    .references(() => assets.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
