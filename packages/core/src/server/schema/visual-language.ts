import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const visualLanguageCategories = sqliteTable('visual_language_category', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  source: text('source').notNull(),
  position: integer('position').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const visualLanguage = sqliteTable(
  'visual_language',
  {
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
  },
  (table) => [index('visual_language_position_id_idx').on(table.position, table.id)]
);
