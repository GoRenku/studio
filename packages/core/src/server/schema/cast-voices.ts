import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import type { JsonValue } from '../../client/json.js';
import { assets } from './assets.js';
import { castMembers } from './cast-members.js';
import { discardLifecycleColumns } from './lifecycle-columns.js';

export const castVoices = sqliteTable(
  'cast_voice',
  {
    id: text('id').primaryKey(),
    castMemberId: text('cast_member_id')
      .notNull()
      .references(() => castMembers.id),
    name: text('name').notNull(),
    purpose: text('purpose').notNull(),
    sampleAssetId: text('sample_asset_id')
      .notNull()
      .references(() => assets.id),
    voiceIdentity: text('voice_identity', { mode: 'json' }).$type<JsonValue>(),
    sortOrder: integer('sort_order').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    ...discardLifecycleColumns(),
  },
  (table) => [
    index('cast_voice_cast_order_idx').on(
      table.castMemberId,
      table.sortOrder,
      table.id
    ),
    uniqueIndex('cast_voice_sample_asset_idx')
      .on(table.sampleAssetId)
      .where(sql`${table.discardedAt} is null`),
    uniqueIndex('cast_voice_cast_name_idx')
      .on(table.castMemberId, table.name)
      .where(sql`${table.discardedAt} is null`),
  ],
);

export const castVoiceDefaults = sqliteTable(
  'cast_voice_default',
  {
    castMemberId: text('cast_member_id')
      .primaryKey()
      .references(() => castMembers.id),
    castVoiceId: text('cast_voice_id')
      .notNull()
      .unique()
      .references(() => castVoices.id),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('cast_voice_default_voice_idx').on(table.castVoiceId),
  ],
);
