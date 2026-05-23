import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { assets } from './assets.js';

export const inspirationFolders = sqliteTable(
  'inspiration_folder',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    projectRelativePath: text('project_relative_path').notNull(),
    position: integer('position').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
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
});

export const lookbook = sqliteTable('lookbook', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  thesis: text('thesis').notNull(),
  palette: text('palette').notNull(),
  toneMood: text('tone_mood').notNull(),
  composition: text('composition').notNull(),
  lighting: text('lighting').notNull(),
  texture: text('texture').notNull(),
  camera: text('camera').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const visualLanguageState = sqliteTable('visual_language_state', {
  id: text('id').primaryKey(),
  activeLookbookId: text('active_lookbook_id').references(() => lookbook.id, {
    onDelete: 'set null',
  }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

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

export const lookbookCardImages = sqliteTable('lookbook_card_image', {
  lookbookId: text('lookbook_id')
    .primaryKey()
    .references(() => lookbook.id, { onDelete: 'cascade' }),
  imageId: text('image_id')
    .notNull()
    .references(() => lookbookImages.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
