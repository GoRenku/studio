import fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROJECT_LOCALE_TAG,
  SUPPORTED_PROJECT_LOCALES,
} from '../../../client/index.js';

describe('migration 0074 missing project base language', () => {
  it('adds the canonical project locale only when the locale table is empty', async () => {
    const sqlite = createProjectLocaleFixture();
    try {
      await applyMigration0074(sqlite);

      const defaultLocale = SUPPORTED_PROJECT_LOCALES.find(
        (locale) => locale.localeTag === DEFAULT_PROJECT_LOCALE_TAG
      );
      expect(sqlite.prepare('select * from project_locale').all()).toEqual([
        {
          id: 'locale_baseenxx',
          locale_tag: DEFAULT_PROJECT_LOCALE_TAG,
          display_name: defaultLocale?.displayName,
          is_base: 1,
          supports_audio: 1,
          supports_subtitles: 1,
          position: 0,
        },
      ]);

      await applyMigration0074(sqlite);
      expect(sqlite.prepare('select * from project_locale').all()).toHaveLength(1);
      expect(sqlite.pragma('foreign_key_check')).toEqual([]);
      expect(sqlite.pragma('quick_check', { simple: true })).toBe('ok');
    } finally {
      sqlite.close();
    }
  });

  it.each([
    {
      name: 'one valid locale',
      rows: [projectLocaleRow('locale_es', 'es-ES', 'Spanish', 1, 0)],
    },
    {
      name: 'multiple valid locales',
      rows: [
        projectLocaleRow('locale_en', 'en-US', 'English', 1, 0),
        projectLocaleRow('locale_tr', 'tr-TR', 'Turkish', 0, 1),
      ],
    },
    {
      name: 'an invalid non-empty locale state',
      rows: [
        projectLocaleRow('locale_en', 'en-US', 'English', 0, 0),
        projectLocaleRow('locale_tr', 'tr-TR', 'Turkish', 0, 1),
      ],
    },
  ])('leaves $name unchanged', async ({ rows }) => {
    const sqlite = createProjectLocaleFixture();
    try {
      const insert = sqlite.prepare(`
        insert into project_locale values (
          @id, @locale_tag, @display_name, @is_base,
          @supports_audio, @supports_subtitles, @position
        )
      `);
      rows.forEach((row) => insert.run(row));
      const before = sqlite.prepare('select * from project_locale order by position').all();

      await applyMigration0074(sqlite);

      expect(sqlite.prepare('select * from project_locale order by position').all()).toEqual(before);
      expect(sqlite.pragma('foreign_key_check')).toEqual([]);
      expect(sqlite.pragma('quick_check', { simple: true })).toBe('ok');
    } finally {
      sqlite.close();
    }
  });
});

async function applyMigration0074(sqlite: Database.Database): Promise<void> {
  const migration = await fs.readFile(
    path.join(
      process.cwd(),
      'drizzle',
      '0074_backfill_missing_project_base_language.sql'
    ),
    'utf8'
  );
  sqlite.exec(migration);
}

function createProjectLocaleFixture(): Database.Database {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(`
    create table project (id text primary key not null);
    insert into project values ('project_test');
    create table project_locale (
      id text primary key not null,
      locale_tag text not null,
      display_name text,
      is_base integer not null,
      supports_audio integer default 1 not null,
      supports_subtitles integer default 1 not null,
      position integer not null
    );
  `);
  return sqlite;
}

function projectLocaleRow(
  id: string,
  localeTag: string,
  displayName: string,
  isBase: number,
  position: number
) {
  return {
    id,
    locale_tag: localeTag,
    display_name: displayName,
    is_base: isBase,
    supports_audio: 1,
    supports_subtitles: 1,
    position,
  };
}
