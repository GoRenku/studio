import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('project', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  title: text('title').notNull(),
  type: text('type').notNull(),
  logline: text('logline'),
  summary: text('summary'),
  aspectRatio: text('aspect_ratio'),
  coverFile: text('cover_file'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const projectLanguages = sqliteTable('project_language', {
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

export const visualLanguage = sqliteTable('visual_language', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  intent: text('intent'),
  summary: text('summary'),
  position: integer('position').notNull(),
});

export const castMembers = sqliteTable('cast_member', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind'),
  role: text('role'),
  shortDescription: text('short_description'),
  position: integer('position').notNull(),
});

export const episodes = sqliteTable('episode', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  shortTitle: text('short_title'),
  episodeNumber: integer('episode_number'),
  summary: text('summary'),
  position: integer('position').notNull(),
});

export const sequences = sqliteTable('sequence', {
  id: text('id').primaryKey(),
  episodeId: text('episode_id'),
  title: text('title').notNull(),
  shortTitle: text('short_title'),
  summary: text('summary'),
  position: integer('position').notNull(),
});

export const scenes = sqliteTable('scene', {
  id: text('id').primaryKey(),
  sequenceId: text('sequence_id').notNull(),
  title: text('title').notNull(),
  summary: text('summary'),
  position: integer('position').notNull(),
});

export const clips = sqliteTable('clip', {
  id: text('id').primaryKey(),
  sceneId: text('scene_id').notNull(),
  title: text('title').notNull(),
  summary: text('summary'),
  visualIntent: text('visual_intent'),
  position: integer('position').notNull(),
});
