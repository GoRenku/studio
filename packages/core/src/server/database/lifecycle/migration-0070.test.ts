import fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('migration 0070 first-class Props', () => {
  it('adds Prop tables and preserves Location recurring objects under the current name', async () => {
    const sqlite = databaseWithLocationDesign(
      JSON.stringify({
        kind: 'locationDesign',
        locationId: 'location_forge',
        design: {
          spatialThesis: 'A working forge.',
          propsAndRecurringObjects: [
            { name: 'anvil', description: 'A scarred iron anvil.' },
          ],
        },
      })
    );

    try {
      await applyMigration0070(sqlite);
      const document = JSON.parse(
        (
          sqlite.prepare(
            "select document_json as documentJson from location_design where id = 'design_forge'"
          ).get() as { documentJson: string }
        ).documentJson
      ) as {
        design: {
          recurringObjects: Array<{ name: string; description: string }>;
          propsAndRecurringObjects?: unknown;
        };
      };

      expect(document.design.recurringObjects).toEqual([
        { name: 'anvil', description: 'A scarred iron anvil.' },
      ]);
      expect(document.design).not.toHaveProperty('propsAndRecurringObjects');
      expect(tableNames(sqlite)).toEqual(
        expect.arrayContaining(['prop', 'prop_design', 'prop_design_state'])
      );
      expect(sqlite.pragma('user_version', { simple: true })).toBe(56);
      expect(sqlite.pragma('foreign_key_check')).toEqual([]);
      expect(sqlite.pragma('quick_check', { simple: true })).toBe('ok');
    } finally {
      sqlite.close();
    }
  });

  it.each([
    ['malformed JSON', '{"kind":"locationDesign"'],
    [
      'both recurring-object keys',
      JSON.stringify({
        design: {
          propsAndRecurringObjects: [],
          recurringObjects: [],
        },
      }),
    ],
  ])('aborts without partial schema changes for %s', async (_label, documentJson) => {
    const sqlite = databaseWithLocationDesign(documentJson);

    try {
      await expect(applyMigration0070(sqlite)).rejects.toThrow();
      expect(tableNames(sqlite)).not.toContain('prop');
      expect(
        (
          sqlite.prepare(
            "select document_json as documentJson from location_design where id = 'design_forge'"
          ).get() as { documentJson: string }
        ).documentJson
      ).toBe(documentJson);
      expect(sqlite.pragma('user_version', { simple: true })).toBe(55);
    } finally {
      sqlite.close();
    }
  });
});

function databaseWithLocationDesign(documentJson: string): Database.Database {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = on');
  sqlite.exec(`
    pragma user_version = 55;
    create table location_design (
      id text primary key not null,
      document_json text not null
    );
    insert into location_design (id, document_json)
    values ('design_forge', ${quoteSql(documentJson)});
  `);
  return sqlite;
}

async function applyMigration0070(sqlite: Database.Database): Promise<void> {
  const migration = await fs.readFile(
    path.join(process.cwd(), 'drizzle', '0070_add_props_continuity_subjects.sql'),
    'utf8'
  );
  const statements = migration
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean);
  sqlite.transaction(() => {
    statements.forEach((statement) => sqlite.exec(statement));
  })();
}

function tableNames(sqlite: Database.Database): string[] {
  return (
    sqlite.prepare(
      "select name from sqlite_master where type = 'table' order by name"
    ).all() as Array<{ name: string }>
  ).map((row) => row.name);
}

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
