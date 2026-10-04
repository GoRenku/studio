import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrateProjectDatabase } from './migrator.js';

const require = createRequire(import.meta.url);

describe('unified AssetFile conversion', () => {
  let directory: string;
  let databasePath: string;
  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-unified-files-'));
    databasePath = path.join(directory, 'project.sqlite');
    const migrations = path.join(directory, 'drizzle');
    await fs.mkdir(path.join(migrations, 'meta'), { recursive: true });
    const journal = JSON.parse(await fs.readFile('drizzle/meta/_journal.json', 'utf8'));
    journal.entries = journal.entries.filter((entry: { tag: string }) => !entry.tag.startsWith('0089_'));
    for (const entry of journal.entries) {
      await fs.copyFile(`drizzle/${entry.tag}.sql`, path.join(migrations, `${entry.tag}.sql`));
    }
    await fs.writeFile(path.join(migrations, 'meta/_journal.json'), JSON.stringify(journal));
    const config = path.join(directory, 'migration.config.ts');
    await fs.writeFile(config, `export default ${JSON.stringify({ dialect: 'sqlite', out: migrations, dbCredentials: { url: databasePath } })}`);
    const result = spawnSync(process.execPath, [path.join(path.dirname(require.resolve('drizzle-kit')), 'bin.cjs'), 'migrate', '--config', config], { encoding: 'utf8' });
    expect(result.status, result.stderr + result.stdout).toBe(0);
    const sqlite = new Database(databasePath);
    sqlite.pragma('foreign_keys = ON');
    sqlite.exec(`
      INSERT INTO asset (id, type, media_kind, title, origin, availability, created_at, updated_at)
        VALUES ('parent', 'reference', 'image', 'Authored title', 'imported', 'ready', 'created', 'updated');
      INSERT INTO asset_file (id, asset_id, role, project_relative_path, media_kind, mime_type, size_bytes, content_hash, created_at, updated_at)
        VALUES ('physical', 'parent', 'primary', 'research/exact.png', 'image', 'image/png', 12, 'hash', 'created', 'updated');
      INSERT INTO asset_membership (asset_id, owner_key, created_at, updated_at) VALUES ('parent', 'project', 'created', 'updated');
      INSERT INTO selected_asset (target_key, asset_id, created_at, updated_at) VALUES ('project', 'parent', 'created', 'updated');
    `);
    sqlite.close();
  }, 20000);
  afterEach(async () => { await fs.rm(directory, { recursive: true, force: true }); });

  it('preserves authored and physical facts, canonical identity, selection and integrity', () => {
    const migration = migrateProjectDatabase(databasePath);
    expect(migration.preMigrationBackup?.backupPath).toBeTruthy();
    const sqlite = new Database(databasePath);
    try {
      expect(sqlite.prepare('select id, owner_key, title, project_relative_path, content_hash from asset_file').get())
        .toEqual({ id: 'physical', owner_key: 'project', title: 'Authored title', project_relative_path: 'research/exact.png', content_hash: 'hash' });
      expect(sqlite.prepare('select asset_file_id from selected_asset_file').get()).toEqual({ asset_file_id: 'physical' });
      expect(sqlite.pragma('foreign_key_check')).toEqual([]);
      expect(sqlite.pragma('quick_check', { simple: true })).toBe('ok');
    } finally { sqlite.close(); }
  });

  it('rejects ambiguous physical identity before any durable conversion', () => {
    const sqlite = new Database(databasePath);
    sqlite.exec(`INSERT INTO asset_file (id, asset_id, role, project_relative_path, media_kind, mime_type, size_bytes, created_at, updated_at)
      VALUES ('second', 'parent', 'alternate', 'research/second.png', 'image', 'image/png', 1, 'created', 'updated')`);
    sqlite.close();
    expect(() => migrateProjectDatabase(databasePath)).toThrow(expect.objectContaining({ code: 'PROJECT_DATA042' }));
    const preserved = new Database(databasePath);
    try {
      expect(preserved.prepare('select id from asset').all()).toEqual([{ id: 'parent' }]);
      expect(preserved.prepare('select id from asset_file order by id').all()).toEqual([{ id: 'physical' }, { id: 'second' }]);
      expect(preserved.pragma('foreign_key_check')).toEqual([]);
    } finally { preserved.close(); }
  });

  it('converts known Trash identity envelopes without rewriting creative values', () => {
    const sqlite = new Database(databasePath);
    const creative = { prompt: 'asset:parent is authored text', notes: ['parent', '雪'] };
    sqlite.exec("INSERT INTO trash_operation (id, command_name, actor_kind, created_at) VALUES ('operation', 'discard', 'user', 'created')");
    sqlite.prepare(`INSERT INTO trash_item (id, operation_id, item_kind, item_id, title, restore_snapshot_json, created_at)
      VALUES ('trash', 'operation', 'asset', 'parent', 'Title', ?, 'created')`)
      .run(JSON.stringify({ assetId: 'parent', creative }));
    sqlite.close();
    migrateProjectDatabase(databasePath);
    const converted = new Database(databasePath);
    try {
      const row = converted.prepare('select item_kind, item_id, restore_snapshot_json from trash_item').get() as {
        item_kind: string; item_id: string; restore_snapshot_json: string;
      };
      expect(row.item_kind).toBe('assetFile');
      expect(row.item_id).toBe('physical');
      expect(JSON.parse(row.restore_snapshot_json)).toEqual({ assetFileId: 'physical', creative });
    } finally { converted.close(); }
  });

  it.each([false, true])('retains historical missing Inspiration images, collected=%s', (collected) => {
    const sqlite = new Database(databasePath);
    sqlite.exec(`INSERT INTO inspiration_folder (id, name, project_relative_path, position, created_at, updated_at)
      VALUES ('folder', 'Reference', 'visual-language/inspiration/reference', 0, 'created', 'updated');
      INSERT INTO trash_operation (id, command_name, actor_kind, created_at) VALUES ('operation', 'discard', 'user', 'created')`);
    sqlite.prepare(`INSERT INTO trash_item (id, operation_id, item_kind, item_id, owner_kind, owner_id, title,
      original_project_relative_path, restore_snapshot_json, created_at, garbage_collected_at)
      VALUES ('trash', 'operation', 'inspirationImage', 'folder/frame.png', 'inspirationFolder', 'folder', 'frame.png', ?, ?, 'created', ?)`)
      .run('visual-language/inspiration/reference/frame.png', JSON.stringify({ folderId: 'folder', originalProjectRelativePath: 'visual-language/inspiration/reference/frame.png' }), collected ? 'collected' : null);
    sqlite.close();
    migrateProjectDatabase(databasePath);
    const converted = new Database(databasePath);
    try {
      const file = converted.prepare("select id, owner_key, discarded_at from asset_file where type='inspiration_image'").get() as { id: string; owner_key: string; discarded_at: string };
      expect(file).toMatchObject({ owner_key: 'inspirationFolder:folder', discarded_at: 'created' });
      expect(converted.prepare('select item_kind, item_id, garbage_collected_at from trash_item').get())
        .toEqual({ item_kind: 'assetFile', item_id: file.id, garbage_collected_at: collected ? 'collected' : null });
      expect(converted.pragma('foreign_key_check')).toEqual([]);
    } finally { converted.close(); }
  });

});
