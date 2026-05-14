import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
