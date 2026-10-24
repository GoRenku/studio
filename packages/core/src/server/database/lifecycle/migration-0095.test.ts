import fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('migration 0095 casting data carry-over', () => {
  it('moves active costume variants under one Main Look, word for word and in order', async () => {
    const sqlite = await createDatabase();
    try {
      insertDesign(sqlite, 'cast_design_old', 'cast_a', [variant('Retired', { kind: 'project' })]);
      insertDesign(sqlite, 'cast_design_active', 'cast_a', [
        variant('Young Ishtar survivor', { kind: 'project' }, ['Scenes 3–6: plain worn leather.'], ['Same hazel eyes']),
        variant('Reveal', { kind: 'scenes', sceneIds: ['scene_13'] }, ['White hair shown.']),
      ]);
      sqlite.prepare("insert into cast_design_state values ('cast_a', 'cast_design_active', 'now')").run();

      runMigration(sqlite, await migrationSql());

      const looks = sqlite.prepare('select cast_member_id, name, position from cast_look').all();
      expect(looks).toEqual([{ cast_member_id: 'cast_a', name: 'Main', position: 0 }]);
      const costumes = sqlite.prepare('select name, wardrobe_json, continuity_notes_json, position from cast_costume order by position').all();
      expect(costumes).toEqual([
        { name: 'Young Ishtar survivor', wardrobe_json: '["Scenes 3–6: plain worn leather."]', continuity_notes_json: '["Same hazel eyes"]', position: 0 },
        { name: 'Reveal', wardrobe_json: '["White hair shown."]', continuity_notes_json: '[]', position: 1 },
      ]);
      expect(sqlite.prepare('select scene_id from cast_costume_scene').pluck().all()).toEqual(['scene_13']);
      expect(sqlite.prepare('select scene_id from cast_look_scene').pluck().all()).toEqual(['scene_13']);
      const documents = sqlite.prepare('select document_json from cast_design').pluck().all() as string[];
      documents.forEach((document) => expect(JSON.parse(document).design.costume).toEqual({ baseWardrobeLogic: ['Leather'] }));
      expect(sqlite.pragma('user_version', { simple: true })).toBe(76);
    } finally {
      sqlite.close();
    }
  });

  it('clears shared arcs, renames the turning point sheet field and adds casting defaults', async () => {
    const sqlite = await createDatabase();
    try {
      const arc = {
        writtenAt: 'now',
        arc: { kind: 'characterArc', turningPoints: [{ label: 'One', lookAssetFileId: 'asset_file_a' }, { label: 'Two' }] },
      };
      sqlite.prepare('update cast_member set character_arc = ? where id = ?').run(JSON.stringify(arc), 'cast_a');
      sqlite.prepare('update cast_member set character_arc = ? where id = ?')
        .run(JSON.stringify({ writtenAt: 'now', arc: { kind: 'characterArcReference', castMemberId: 'cast_a' } }), 'cast_b');
      sqlite.prepare('insert into project_settings values (?)').run(JSON.stringify({ version: 7, generation: {} }));

      runMigration(sqlite, await migrationSql());

      const stored = JSON.parse(sqlite.prepare("select character_arc from cast_member where id = 'cast_a'").pluck().get() as string);
      expect(stored.arc.turningPoints).toEqual([{ label: 'One', characterSheetAssetFileId: 'asset_file_a' }, { label: 'Two' }]);
      expect(sqlite.prepare("select character_arc from cast_member where id = 'cast_b'").pluck().get()).toBeNull();
      expect(JSON.parse(sqlite.prepare('select document from project_settings').pluck().get() as string))
        .toEqual({ version: 8, generation: {}, casting: { routes: [] } });
    } finally {
      sqlite.close();
    }
  });

  it('aborts when Project Settings are not version 7', async () => {
    const sqlite = await createDatabase();
    try {
      sqlite.prepare('insert into project_settings values (?)').run(JSON.stringify({ version: 6 }));
      const sql = await migrationSql();
      expect(() => runMigration(sqlite, sql)).toThrow();
    } finally {
      sqlite.close();
    }
  });
});

function variant(label: string, scope: unknown, wardrobe = ['Robe'], continuityNotes?: string[]) {
  return { label, scope, wardrobe, ...(continuityNotes ? { continuityNotes } : {}) };
}

function insertDesign(sqlite: Database.Database, id: string, castMemberId: string, variants: unknown[]): void {
  const document = { kind: 'castDesign', castMemberId, design: { costume: { baseWardrobeLogic: ['Leather'], variants } } };
  sqlite.prepare('insert into cast_design values (?, ?, ?)').run(id, castMemberId, JSON.stringify(document));
}

async function createDatabase(): Promise<Database.Database> {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    create table cast_member (id text primary key not null, character_arc text);
    insert into cast_member values ('cast_a', null), ('cast_b', null);
    create table scene (id text primary key not null);
    insert into scene values ('scene_13');
    create table asset_file (id text primary key not null);
    create table cast_design (id text primary key not null, cast_member_id text not null, document_json text not null);
    create table cast_design_state (cast_member_id text primary key not null, active_design_id text not null, updated_at text not null);
    create table project_settings (document text not null);
  `);
  sqlite.exec((await migrationFile('0094_casting_looks_costumes_rounds.sql')).replaceAll('--> statement-breakpoint', ''));
  sqlite.pragma('user_version = 75');
  return sqlite;
}

function runMigration(sqlite: Database.Database, sql: string): void {
  sqlite.exec(sql.replaceAll('--> statement-breakpoint', ''));
}

async function migrationSql(): Promise<string> {
  return migrationFile('0095_casting_data_carry_over.sql');
}

async function migrationFile(name: string): Promise<string> {
  return fs.readFile(path.join(process.cwd(), 'drizzle', name), 'utf8');
}
