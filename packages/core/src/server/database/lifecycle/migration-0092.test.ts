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

  const subjects = [
    { table: 'cast_member', parse: parseStoredCastMemberDescription },
    { table: 'location', parse: parseStoredLocationDescription },
    { table: 'prop', parse: parseStoredPropDescription },
  ];
  const whitespace = '\t\n\v\f\r \u00a0\u1680'
    + '\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a'
    + '\u2028\u2029\u202f\u205f\u3000\ufeff';

  it.each(subjects)('stores missing and schema-blank $table descriptions as NULL', async ({ table, parse }) => {
    const sqlite = createDatabase();
    try {
      const descriptions = [null, '', ...whitespace, whitespace];
      const insert = sqlite.prepare(`insert into ${table} values (?, ?)`);
      descriptions.forEach((description, index) => {
        insert.run(String(index), description);
        if (description !== null) {
          expect(() => parse(JSON.stringify({ overview: description }), String(index)))
            .toThrow(expect.objectContaining({ code: 'PROFILE_DESCRIPTION_STORED_INVALID' }));
        }
      });

      runMigration(sqlite, await migrationSql());

      descriptions.forEach((_description, index) => {
        const stored = readDescription(sqlite, table, String(index));
        expect(stored).toBeNull();
        expect(parse(stored, String(index))).toBeUndefined();
      });
    } finally {
      sqlite.close();
    }
  });

  it.each(subjects)('preserves non-blank $table descriptions including surrounding whitespace', async ({ table, parse }) => {
    const sqlite = createDatabase();
    try {
      const descriptions = [
        `${whitespace}Authored text.\n\nAnother paragraph.${whitespace}`,
        '\u0085',
        '\u180e',
        '\u200b',
      ];
      const insert = sqlite.prepare(`insert into ${table} values (?, ?)`);
      descriptions.forEach((description, index) => insert.run(String(index), description));

      runMigration(sqlite, await migrationSql());

      descriptions.forEach((description, index) => {
        expect(parse(readDescription(sqlite, table, String(index)), String(index)))
          .toEqual({ overview: description });
      });
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
