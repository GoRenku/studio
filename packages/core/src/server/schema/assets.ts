import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { castMembers } from './cast-members.js';
import { continuityReferences } from './continuity-references.js';
import { clips, scenes, sequences } from './narrative.js';
import { projectLocales } from './project-locales.js';
import { visualLanguage } from './visual-language.js';

export const assets = sqliteTable('asset', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  mediaKind: text('media_kind').notNull(),
  title: text('title').notNull(),
  oneLineSummary: text('one_line_summary'),
  origin: text('origin').notNull(),
  availability: text('availability').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
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
  },
  (table) => [index('asset_file_asset_role_idx').on(table.assetId, table.role)]
);

export const projectAssets = sqliteTable(
  'project_asset',
  {
    id: text('id').primaryKey(),
    assetId: text('asset_id')
      .notNull()
      .references(() => assets.id),
    localeId: text('locale_id').references(() => projectLocales.id),
    role: text('role').notNull(),
    sortOrder: integer('sort_order').notNull(),
    selection: text('selection').notNull().default('take'),
    selectionOrder: integer('selection_order'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('project_asset_filter_order_idx').on(
      table.role,
      table.selection,
      table.selectionOrder,
      table.sortOrder,
      table.assetId
    ),
  ]
);

export const visualLanguageAssets = sqliteTable(
  'visual_language_asset',
  {
    id: text('id').primaryKey(),
    visualLanguageId: text('visual_language_id')
      .notNull()
      .references(() => visualLanguage.id),
    assetId: text('asset_id')
      .notNull()
      .references(() => assets.id),
    localeId: text('locale_id').references(() => projectLocales.id),
    role: text('role').notNull(),
    sortOrder: integer('sort_order').notNull(),
    selection: text('selection').notNull().default('take'),
    selectionOrder: integer('selection_order'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('visual_language_asset_filter_order_idx').on(
      table.visualLanguageId,
      table.role,
      table.selection,
      table.selectionOrder,
      table.sortOrder,
      table.assetId
    ),
  ]
);

export const castAssets = sqliteTable(
  'cast_asset',
  {
    id: text('id').primaryKey(),
    castMemberId: text('cast_member_id')
      .notNull()
      .references(() => castMembers.id),
    assetId: text('asset_id')
      .notNull()
      .references(() => assets.id),
    localeId: text('locale_id').references(() => projectLocales.id),
    role: text('role').notNull(),
    sortOrder: integer('sort_order').notNull(),
    selection: text('selection').notNull().default('take'),
    selectionOrder: integer('selection_order'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('cast_asset_filter_order_idx').on(
      table.castMemberId,
      table.role,
      table.selection,
      table.selectionOrder,
      table.sortOrder,
      table.assetId
    ),
  ]
);

export const continuityReferenceAssets = sqliteTable(
  'continuity_reference_asset',
  {
    id: text('id').primaryKey(),
    continuityReferenceId: text('continuity_reference_id')
      .notNull()
      .references(() => continuityReferences.id),
    assetId: text('asset_id')
      .notNull()
      .references(() => assets.id),
    localeId: text('locale_id').references(() => projectLocales.id),
    role: text('role').notNull(),
    sortOrder: integer('sort_order').notNull(),
    selection: text('selection').notNull().default('take'),
    selectionOrder: integer('selection_order'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('continuity_reference_asset_filter_order_idx').on(
      table.continuityReferenceId,
      table.role,
      table.selection,
      table.selectionOrder,
      table.sortOrder,
      table.assetId
    ),
  ]
);

export const sequenceAssets = sqliteTable(
  'sequence_asset',
  {
    id: text('id').primaryKey(),
    sequenceId: text('sequence_id')
      .notNull()
      .references(() => sequences.id),
    assetId: text('asset_id')
      .notNull()
      .references(() => assets.id),
    localeId: text('locale_id').references(() => projectLocales.id),
    role: text('role').notNull(),
    sortOrder: integer('sort_order').notNull(),
    selection: text('selection').notNull().default('take'),
    selectionOrder: integer('selection_order'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('sequence_asset_filter_order_idx').on(
      table.sequenceId,
      table.role,
      table.selection,
      table.selectionOrder,
      table.sortOrder,
      table.assetId
    ),
  ]
);

export const sceneAssets = sqliteTable(
  'scene_asset',
  {
    id: text('id').primaryKey(),
    sceneId: text('scene_id')
      .notNull()
      .references(() => scenes.id),
    assetId: text('asset_id')
      .notNull()
      .references(() => assets.id),
    localeId: text('locale_id').references(() => projectLocales.id),
    role: text('role').notNull(),
    sortOrder: integer('sort_order').notNull(),
    selection: text('selection').notNull().default('take'),
    selectionOrder: integer('selection_order'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('scene_asset_filter_order_idx').on(
      table.sceneId,
      table.role,
      table.selection,
      table.selectionOrder,
      table.sortOrder,
      table.assetId
    ),
  ]
);

export const clipAssets = sqliteTable(
  'clip_asset',
  {
    id: text('id').primaryKey(),
    clipId: text('clip_id')
      .notNull()
      .references(() => clips.id),
    assetId: text('asset_id')
      .notNull()
      .references(() => assets.id),
    localeId: text('locale_id').references(() => projectLocales.id),
    role: text('role').notNull(),
    sortOrder: integer('sort_order').notNull(),
    selection: text('selection').notNull().default('take'),
    selectionOrder: integer('selection_order'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('clip_asset_filter_order_idx').on(
      table.clipId,
      table.role,
      table.selection,
      table.selectionOrder,
      table.sortOrder,
      table.assetId
    ),
  ]
);
