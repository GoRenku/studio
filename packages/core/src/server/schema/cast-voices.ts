import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { assets } from './assets.js';
import { castMembers } from './cast-members.js';

export const castVoices = sqliteTable(
  'cast_voice',
  {
    id: text('id').primaryKey(),
    castMemberId: text('cast_member_id')
      .notNull()
      .references(() => castMembers.id),
    name: text('name').notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    voiceId: text('voice_id').notNull(),
    purpose: text('purpose').notNull(),
    sampleAssetId: text('sample_asset_id')
      .notNull()
      .references(() => assets.id),
    sampleSourceKind: text('sample_source_kind').notNull().default('custom_file'),
    sampleId: text('sample_id'),
    sampleFetchedAt: text('sample_fetched_at'),
    sampleApiBaseUrl: text('sample_api_base_url'),
    sortOrder: integer('sort_order').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('cast_voice_cast_order_idx').on(
      table.castMemberId,
      table.sortOrder,
      table.id
    ),
    index('cast_voice_provider_model_voice_idx').on(
      table.provider,
      table.model,
      table.voiceId
    ),
    uniqueIndex('cast_voice_sample_asset_idx').on(table.sampleAssetId),
    uniqueIndex('cast_voice_cast_name_idx').on(table.castMemberId, table.name),
  ],
);
