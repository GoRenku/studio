import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('project', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  title: text('title').notNull(),
  type: text('type').notNull(),
  logline: text('logline'),
  aspectRatio: text('aspect_ratio'),
  coverFile: text('cover_file'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const projectLocales = sqliteTable('project_locale', {
  id: text('id').primaryKey(),
  localeTag: text('locale_tag').notNull(),
  displayName: text('display_name'),
  isBase: integer('is_base', { mode: 'boolean' }).notNull(),
  supportsAudio: integer('supports_audio', { mode: 'boolean' }).notNull().default(true),
  supportsSubtitles: integer('supports_subtitles', { mode: 'boolean' })
    .notNull()
    .default(true),
  position: integer('position').notNull(),
});

export const visualLanguageCategories = sqliteTable('visual_language_category', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  source: text('source').notNull(),
  position: integer('position').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const visualLanguage = sqliteTable('visual_language', {
  id: text('id').primaryKey(),
  categoryId: text('category_id')
    .notNull()
    .references(() => visualLanguageCategories.id),
  name: text('name').notNull(),
  oneLineSummary: text('one_line_summary'),
  priority: text('priority').notNull(),
  position: integer('position').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const castMembers = sqliteTable('cast_member', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind'),
  role: text('role'),
  shortDescription: text('short_description'),
  position: integer('position').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const continuityReferences = sqliteTable('continuity_reference', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  name: text('name').notNull(),
  oneLineSummary: text('one_line_summary'),
  position: integer('position').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const episodes = sqliteTable('episode', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  shortTitle: text('short_title'),
  episodeNumber: integer('episode_number'),
  oneLineSummary: text('one_line_summary'),
  position: integer('position').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const sequences = sqliteTable('sequence', {
  id: text('id').primaryKey(),
  episodeId: text('episode_id').references(() => episodes.id),
  title: text('title').notNull(),
  shortTitle: text('short_title'),
  oneLineSummary: text('one_line_summary'),
  position: integer('position').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const scenes = sqliteTable('scene', {
  id: text('id').primaryKey(),
  sequenceId: text('sequence_id')
    .notNull()
    .references(() => sequences.id),
  title: text('title').notNull(),
  oneLineSummary: text('one_line_summary'),
  position: integer('position').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const clips = sqliteTable('clip', {
  id: text('id').primaryKey(),
  sceneId: text('scene_id')
    .notNull()
    .references(() => scenes.id),
  title: text('title').notNull(),
  oneLineSummary: text('one_line_summary'),
  position: integer('position').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

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

export const assetFiles = sqliteTable('asset_file', {
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
});

export const projectAssets = sqliteTable('project_asset', {
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
});

export const visualLanguageAssets = sqliteTable('visual_language_asset', {
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
});

export const castAssets = sqliteTable('cast_asset', {
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
});

export const continuityReferenceAssets = sqliteTable('continuity_reference_asset', {
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
});

export const sequenceAssets = sqliteTable('sequence_asset', {
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
});

export const sceneAssets = sqliteTable('scene_asset', {
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
});

export const clipAssets = sqliteTable('clip_asset', {
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
});
