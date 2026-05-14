import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const projectLocales = sqliteTable(
  'project_locale',
  {
    id: text('id').primaryKey(),
    localeTag: text('locale_tag').notNull(),
    displayName: text('display_name'),
    isBase: integer('is_base', { mode: 'boolean' }).notNull(),
    supportsAudio: integer('supports_audio', { mode: 'boolean' }).notNull().default(true),
    supportsSubtitles: integer('supports_subtitles', { mode: 'boolean' })
      .notNull()
      .default(true),
    position: integer('position').notNull(),
  },
  (table) => [index('project_locale_position_id_idx').on(table.position, table.id)]
);
