import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { projectLocales } from './project-locales.js';
import { discardLifecycleColumns } from './lifecycle-columns.js';
import type { MediaGenerationProvenance } from '../../client/media-generation-review.js';

export const assetFiles = sqliteTable('asset_file', {
  id: text('id').primaryKey(),
  ownerKey: text('owner_key').notNull(),
  localeId: text('locale_id').references(() => projectLocales.id),
  type: text('type').notNull(),
  mediaKind: text('media_kind').notNull(),
  title: text('title'),
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
  previsRevisionId: text('previs_revision_id'),
  projectRelativePath: text('project_relative_path').notNull(),
  mimeType: text('mime_type'),
  sizeBytes: integer('size_bytes'),
  contentHash: text('content_hash'),
  width: integer('width'),
  height: integer('height'),
  durationSeconds: real('duration_seconds'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  ...discardLifecycleColumns(),
}, (table) => [
  uniqueIndex('asset_file_path_idx').on(table.projectRelativePath),
  index('asset_file_owner_type_locale_idx').on(table.ownerKey, table.type, table.localeId),
  index('asset_file_previs_revision_idx').on(table.previsRevisionId),
]);

export const selectedAssetFiles = sqliteTable('selected_asset_file', {
  targetKey: text('target_key').primaryKey(),
  assetFileId: text('asset_file_id')
    .notNull()
    .references(() => assetFiles.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
