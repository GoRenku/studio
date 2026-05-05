import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const studioProjects = sqliteTable('studio_project', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
