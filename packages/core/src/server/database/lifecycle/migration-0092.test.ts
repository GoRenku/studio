import fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  parseStoredCastMemberDescription,
  parseStoredLocationDescription,
  parseStoredPropDescription,
} from '../../profile-descriptions/validator.js';

describe('migration 0092 sectioned profile descriptions', () => {
  it('moves existing description text into the overview section word for word', async () => {
    const sqlite = createDatabase();
    try {
      const text = 'IDENTITY AND APPEARANCE\nA slender girl.\n\nBEHAVIOUR\nAlert and agile.';
      sqlite.prepare('insert into cast_member values (?, ?)').run('cast_a', text);
      sqlite.prepare('insert into location values (?, ?)').run('location_a', 'A huge cavern.');
      sqlite.prepare('insert into prop values (?, ?)').run('prop_a', 'A spiked spear.');
      sqlite.pragma('user_version = 73');

      runMigration(sqlite, await migrationSql());

      const cast = readDescription(sqlite, 'cast_member', 'cast_a');
      expect(JSON.parse(cast as string)).toEqual({ overview: text });
      expect(parseStoredCastMemberDescription(cast, 'cast_a')).toEqual({ overview: text });
      expect(parseStoredLocationDescription(readDescription(sqlite, 'location', 'location_a'), 'location_a'))
        .toEqual({ overview: 'A huge cavern.' });
      expect(parseStoredPropDescription(readDescription(sqlite, 'prop', 'prop_a'), 'prop_a'))
        .toEqual({ overview: 'A spiked spear.' });
      expect(sqlite.pragma('user_version', { simple: true })).toBe(74);
    } finally {
      sqlite.close();
    }
  });

  it('stores missing and blank descriptions as NULL', async () => {
    const sqlite = createDatabase();
    try {
      sqlite.prepare('insert into cast_member values (?, ?)').run('cast_null', null);
      sqlite.prepare('insert into cast_member values (?, ?)').run('cast_blank', '  \n ');

      runMigration(sqlite, await migrationSql());

      expect(readDescription(sqlite, 'cast_member', 'cast_null')).toBeNull();
      expect(readDescription(sqlite, 'cast_member', 'cast_blank')).toBeNull();
    } finally {
      sqlite.close();
    }
  });
});

function readDescription(sqlite: Database.Database, table: string, id: string): string | null {
  return sqlite.prepare(`select description from ${table} where id = ?`).pluck().get(id) as string | null;
}

function createDatabase(): Database.Database {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    create table cast_member (id text primary key not null, description text);
    create table location (id text primary key not null, description text);
    create table prop (id text primary key not null, description text);
  `);
  return sqlite;
}

function runMigration(sqlite: Database.Database, sql: string): void {
  sqlite.exec(sql.replaceAll('--> statement-breakpoint', ''));
}

async function migrationSql(): Promise<string> {
  return fs.readFile(
    path.join(process.cwd(), 'drizzle', '0092_sectioned_profile_descriptions.sql'),
    'utf8'
  );
}
