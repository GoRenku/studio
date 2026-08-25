import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { projectLocales } from './project-locales.js';
import { discardLifecycleColumns } from './lifecycle-columns.js';
import type { MediaGenerationProvenance } from '../../client/media-generation-review.js';

export const assets = sqliteTable('asset', {
  id: text('id').primaryKey(),
  localeId: text('locale_id').references(() => projectLocales.id),
  type: text('type').notNull(),
  mediaKind: text('media_kind').notNull(),
  title: text('title').notNull(),
  oneLineSummary: text('one_line_summary'),
  referenceName: text('reference_name'),
  tags: text('tags', { mode: 'json' })
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'`),
  origin: text('origin').notNull(),
  availability: text('availability').notNull(),
  generationProvenance: text('generation_provenance', { mode: 'json' })
    .$type<MediaGenerationProvenance>(),
  authoredFromShotPlanId: text('authored_from_shot_plan_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  ...discardLifecycleColumns(),
});

export const assetFiles = sqliteTable(
  'asset_file',
  {
    id: text('id').primaryKey(),
    assetId: text('asset_id')
      .notNull()
      .references(() => assets.id),
    role: text('role').notNull(),
    projectRelativePath: text('project_relative_path').notNull(),
    mimeType: text('mime_type'),
    mediaKind: text('media_kind').notNull(),
    sizeBytes: integer('size_bytes'),
    contentHash: text('content_hash'),
    width: integer('width'),
    height: integer('height'),
    durationSeconds: real('duration_seconds'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    ...discardLifecycleColumns(),
  },
  (table) => [index('asset_file_asset_role_idx').on(table.assetId, table.role)],
);

export const assetMemberships = sqliteTable(
  'asset_membership',
  {
    assetId: text('asset_id')
      .primaryKey()
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    ownerKey: text('owner_key').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('asset_membership_owner_idx').on(table.ownerKey, table.assetId),
  ],
);

export const selectedAssets = sqliteTable('selected_asset', {
  targetKey: text('target_key').primaryKey(),
  assetId: text('asset_id')
    .notNull()
    .references(() => assets.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
