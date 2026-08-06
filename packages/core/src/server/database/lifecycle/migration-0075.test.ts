import fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT_SETTINGS } from '../../project-settings/document.js';

describe('migration 0075 Core-owned Project Settings', () => {
  it('creates exactly one constrained two-column singleton with the exact default', async () => {
    const sqlite = new Database(':memory:');
    try {
      sqlite.exec("create table project (id text primary key); insert into project values ('project_test');");
      const migration = await fs.readFile(
        path.join(process.cwd(), 'drizzle', '0075_core_owned_project_settings.sql'),
        'utf8'
      );
      sqlite.exec(migration.replaceAll('--> statement-breakpoint', ''));

      expect(
        sqlite.prepare('pragma table_info(project_settings)').all()
      ).toEqual([
        expect.objectContaining({ name: 'singleton_id', type: 'INTEGER', pk: 1 }),
        expect.objectContaining({ name: 'document', type: 'TEXT', notnull: 1 }),
      ]);
      expect(
        sqlite.prepare('select * from project_settings').all()
      ).toEqual([
        {
          singleton_id: 1,
          document: JSON.stringify(DEFAULT_PROJECT_SETTINGS),
        },
      ]);
      expect(() =>
        sqlite
          .prepare('insert into project_settings values (?, ?)')
          .run(2, JSON.stringify(DEFAULT_PROJECT_SETTINGS))
      ).toThrow();
      expect(() =>
        sqlite
          .prepare('insert into project_settings values (?, ?)')
          .run(1, JSON.stringify(DEFAULT_PROJECT_SETTINGS))
      ).toThrow();
      expect(sqlite.pragma('quick_check', { simple: true })).toBe('ok');
      expect(sqlite.pragma('user_version', { simple: true })).toBe(60);
    } finally {
      sqlite.close();
    }
  });
});
