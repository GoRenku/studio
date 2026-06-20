import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
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
    sampleSourceKind: text('sample_source_kind').notNull().default('custom_file'),
    sampleId: text('sample_id'),
    sampleFetchedAt: text('sample_fetched_at'),
    sampleApiBaseUrl: text('sample_api_base_url'),
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

export const castVoiceProviderRegistrations = sqliteTable(
  'cast_voice_provider_registration',
  {
    id: text('id').primaryKey(),
    castVoiceId: text('cast_voice_id')
      .notNull()
      .references(() => castVoices.id),
    provider: text('provider').notNull(),
    registrationModel: text('registration_model').notNull(),
    externalVoiceId: text('external_voice_id').notNull(),
    capabilitiesJson: text('capabilities_json').notNull(),
    sourceSampleAssetId: text('source_sample_asset_id').references(() => assets.id),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    ...discardLifecycleColumns(),
  },
  (table) => [
    index('cast_voice_provider_registration_voice_idx').on(
      table.castVoiceId,
      table.provider
    ),
    index('cast_voice_provider_registration_external_idx').on(
      table.provider,
      table.registrationModel,
      table.externalVoiceId
    ),
  ],
);
