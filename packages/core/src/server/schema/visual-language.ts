import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { assets } from './assets.js';
import { discardLifecycleColumns } from './lifecycle-columns.js';

export const inspirationFolders = sqliteTable(
  'inspiration_folder',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    projectRelativePath: text('project_relative_path').notNull(),
    position: integer('position').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    ...discardLifecycleColumns(),
  },
  (table) => [
    index('inspiration_folder_position_id_idx').on(table.position, table.id),
  ]
);

export const inspirationAnalysis = sqliteTable('inspiration_analysis', {
  folderId: text('folder_id')
    .primaryKey()
    .references(() => inspirationFolders.id, { onDelete: 'cascade' }),
  thesis: text('thesis').notNull(),
  palette: text('palette').notNull(),
  toneMood: text('tone_mood').notNull(),
  composition: text('composition').notNull(),
  lighting: text('lighting').notNull(),
  texture: text('texture').notNull(),
  inspiredBy: text('inspired_by').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  ...discardLifecycleColumns(),
});

export const lookbook = sqliteTable('lookbook', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type', { enum: ['movie', 'storyboard'] }).notNull(),
  definitionJson: text('definition_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  ...discardLifecycleColumns(),
});

export const lookbookInspirations = sqliteTable(
  'lookbook_inspiration',
  {
    id: text('id').primaryKey(),
    lookbookId: text('lookbook_id')
      .notNull()
      .references(() => lookbook.id, { onDelete: 'cascade' }),
    inspirationFolderId: text('inspiration_folder_id')
      .notNull()
      .references(() => inspirationFolders.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    ...discardLifecycleColumns(),
  },
  (table) => [
    uniqueIndex('lookbook_inspiration_folder_unique_idx')
      .on(
      table.lookbookId,
      table.inspirationFolderId
      )
      .where(sql`${table.discardedAt} is null`),
    uniqueIndex('lookbook_inspiration_order_unique_idx')
      .on(
      table.lookbookId,
      table.sortOrder
      )
      .where(sql`${table.discardedAt} is null`),
    index('lookbook_inspiration_lookup_idx').on(
      table.inspirationFolderId,
      table.lookbookId
    ),
  ]
);

export const lookbookSelections = sqliteTable(
  'lookbook_selection',
  {
    lookbookType: text('lookbook_type', { enum: ['movie', 'storyboard'] })
      .primaryKey()
      .notNull(),
    lookbookId: text('lookbook_id')
      .notNull()
      .references(() => lookbook.id, { onDelete: 'cascade' }),
    selectedAt: text('selected_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('lookbook_selection_lookbook_idx').on(table.lookbookId),
  ]
);

export const storyboardLookbookSourceMovies = sqliteTable(
  'storyboard_lookbook_source_movie',
  {
    storyboardLookbookId: text('storyboard_lookbook_id')
      .notNull()
      .references(() => lookbook.id, { onDelete: 'cascade' }),
    movieLookbookId: text('movie_lookbook_id')
      .notNull()
      .references(() => lookbook.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    ...discardLifecycleColumns(),
  },
  (table) => [
    primaryKey({
      columns: [table.storyboardLookbookId, table.movieLookbookId],
    }),
    index('storyboard_lookbook_source_movie_order_idx').on(
      table.storyboardLookbookId,
      table.sortOrder
    ),
    index('storyboard_lookbook_source_movie_movie_idx').on(table.movieLookbookId),
  ]
);

export const lookbookImages = sqliteTable(
  'lookbook_image',
  {
    id: text('id').primaryKey(),
    lookbookId: text('lookbook_id')
      .notNull()
      .references(() => lookbook.id, { onDelete: 'cascade' }),
    assetId: text('asset_id')
      .notNull()
      .references(() => assets.id),
    sortOrder: integer('sort_order').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    ...discardLifecycleColumns(),
  },
  (table) => [
    index('lookbook_image_order_idx').on(
      table.lookbookId,
      table.sortOrder,
      table.id
    ),
  ]
);

export const lookbookImageSections = sqliteTable(
  'lookbook_image_section',
  {
    id: text('id').primaryKey(),
    imageId: text('image_id')
      .notNull()
      .references(() => lookbookImages.id, { onDelete: 'cascade' }),
    section: text('section').notNull(),
    sortOrder: integer('sort_order').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    ...discardLifecycleColumns(),
  },
  (table) => [
    index('lookbook_image_section_order_idx').on(
      table.section,
      table.sortOrder,
      table.id
    ),
    index('lookbook_image_section_image_idx').on(table.imageId),
  ]
);

export const lookbookSheets = sqliteTable(
  'lookbook_sheet',
  {
    id: text('id').primaryKey(),
    lookbookId: text('lookbook_id')
      .notNull()
      .references(() => lookbook.id, { onDelete: 'cascade' }),
    assetId: text('asset_id')
      .notNull()
      .references(() => assets.id),
    sortOrder: integer('sort_order').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    ...discardLifecycleColumns(),
  },
  (table) => [
    index('lookbook_sheet_order_idx').on(
      table.lookbookId,
      table.sortOrder,
      table.id
    ),
  ]
);

export const lookbookCardImages = sqliteTable('lookbook_card_image', {
  lookbookId: text('lookbook_id')
    .primaryKey()
    .references(() => lookbook.id, { onDelete: 'cascade' }),
  imageId: text('image_id')
    .notNull()
    .references(() => lookbookImages.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  ...discardLifecycleColumns(),
});
