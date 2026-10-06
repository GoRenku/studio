import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createProjectDataService } from '../../project-data-service.js';
import { createBlankMovieProject, writeConfig } from '../../testing/project-data-fixtures.js';
import { closeProjectStore, openProjectStore } from './store.js';

async function fixture() {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-upgrade-readiness-'));
  await writeConfig(homeDir, path.join(homeDir, 'projects'));
  const service = createProjectDataService();
  const created = await createBlankMovieProject({ homeDir, projectData: service });
  expect(created).not.toBeNull();
  return { homeDir, service, projectFolder: created!.projectPath, projectName: created!.projectName };
}

describe('Project upgrade readiness and recovery', () => {
  it.each(['future generation', 'empty journal', 'missing journal'])('rejects %s before returning a session or changing the database', async (state) => {
    const { projectFolder } = await fixture();
    const ready = openProjectStore({ projectFolder, create: false });
    ready.close();
    closeProjectStore({ projectFolder });
    const databasePath = path.join(projectFolder, '.renku/project.sqlite');
    const sqlite = new Database(databasePath);
    try {
      if (state === 'future generation') { sqlite.pragma(`user_version = ${Number(sqlite.pragma('user_version', { simple: true })) + 1}`); }
      else if (state === 'empty journal') { sqlite.exec('delete from __drizzle_migrations'); }
      else { sqlite.exec('drop table __drizzle_migrations'); }
    } finally { sqlite.close(); }
    const before = await fs.readFile(databasePath);
    expect(() => openProjectStore({ projectFolder, create: false, lifetime: 'project' }))
      .toThrow(expect.objectContaining({ code: 'PROJECT_DATA044' }));
    expect(await fs.readFile(databasePath)).toEqual(before);
  });

  it('releases the cached connection before a failing explicit backup boundary', async () => {
    const { homeDir, service, projectFolder, projectName } = await fixture();
    const cached = openProjectStore({ projectFolder, create: false, lifetime: 'project' });
    const backups = path.join(projectFolder, '.renku/project-database-backups');
    await fs.writeFile(backups, 'blocked');
    await expect(service.migrateProjectDatabase({ homeDir, projectName }))
      .rejects.toMatchObject({ code: 'PROJECT_DATA046', issues: expect.any(Array) });
    expect(() => cached.db.get(sql`select 1`)).toThrow();
    await fs.rename(backups, `${backups}.blocked`);
    await expect(service.migrateProjectDatabase({ homeDir, projectName })).resolves.toMatchObject({
      preMigrationBackup: { backupPath: expect.any(String) },
    });
    closeProjectStore({ projectFolder });
  });

  it.each(['owner', 'hash'])('blocks a conflicting registered reference %s before writing and preserves its identity on retry', async (conflict) => {
    const { homeDir, service, projectFolder, projectName } = await fixture();
    const folder = (await service.createInspirationFolder({ homeDir, projectName, name: 'References' })).folder;
    const relative = `${folder.projectRelativePath}/reference.png`;
    await fs.writeFile(path.join(projectFolder, relative), 'opaque reference');
    const setup = openProjectStore({ projectFolder, create: false });
    setup.db.run(sql`insert into asset_file (id, owner_key, type, media_kind, origin, availability,
      project_relative_path, content_hash, created_at, updated_at) values
      ('saved-reference', ${conflict === 'owner' ? 'project' : `inspirationFolder:${folder.id}`},
      'inspiration_image', 'image', 'imported', 'ready', ${relative},
      ${conflict === 'hash' ? '0'.repeat(64) : null}, 'saved-created', 'saved-updated')`);
    setup.db.run(sql`update project set asset_file_backfill_version = 0`);
    const before = setup.db.all(sql`select * from asset_file`);
    setup.close();
    closeProjectStore({ projectFolder });
    await expect(service.migrateProjectDatabase({ homeDir, projectName })).rejects.toMatchObject({
      code: 'PROJECT_ASSET_FILE_BACKFILL_FAILED',
      issues: expect.arrayContaining([expect.objectContaining({ location: expect.objectContaining({
        context: 'reference registration failed', filePath: expect.stringContaining('project-before-migration'),
      }) })]),
    });
    const inspection = new Database(path.join(projectFolder, '.renku/project.sqlite'));
    try {
      expect(inspection.prepare('select * from asset_file').all()).toEqual(before);
      expect(inspection.prepare('select asset_file_backfill_version from project').get()).toEqual({ asset_file_backfill_version: 0 });
      inspection.prepare('update asset_file set owner_key = ?, content_hash = null where id = ?')
        .run(`inspirationFolder:${folder.id}`, 'saved-reference');
    } finally { inspection.close(); }
    await service.migrateProjectDatabase({ homeDir, projectName });
    const ready = openProjectStore({ projectFolder, create: false });
    try {
      expect(ready.db.all(sql`select id, created_at, updated_at, content_hash from asset_file`)).toEqual([{
        id: 'saved-reference', created_at: 'saved-created', updated_at: 'saved-updated',
        content_hash: createHash('sha256').update('opaque reference').digest('hex'),
      }]);
    } finally { ready.close(); }
  });

  if (process.platform !== 'win32') {
    it('retains recovery context after a native reference read failure and completes registration after permission repair', async () => {
      const { homeDir, service, projectFolder, projectName } = await fixture();
      const folder = (await service.createInspirationFolder({ homeDir, projectName, name: 'References' })).folder;
      const file = path.join(projectFolder, folder.projectRelativePath, 'unreadable.png');
      await fs.writeFile(file, 'opaque reference', { mode: 0o000 });
      const setup = openProjectStore({ projectFolder, create: false });
      setup.db.run(sql`update project set asset_file_backfill_version = 0`);
      setup.close();
      closeProjectStore({ projectFolder });
      try {
        await expect(service.migrateProjectDatabase({ homeDir, projectName })).rejects.toMatchObject({
          code: 'PROJECT_ASSET_FILE_BACKFILL_FAILED',
          issues: expect.arrayContaining([expect.objectContaining({ location: expect.objectContaining({
            context: 'reference registration failed', filePath: expect.stringContaining('project-before-migration'),
          }) })]),
        });
        const inspection = new Database(path.join(projectFolder, '.renku/project.sqlite'), { readonly: true });
        try {
          expect(inspection.prepare('select count(*) as count from asset_file').get()).toEqual({ count: 0 });
          expect(inspection.prepare('select asset_file_backfill_version from project').get()).toEqual({ asset_file_backfill_version: 0 });
        } finally { inspection.close(); }
      } finally { await fs.chmod(file, 0o600); }
      await service.migrateProjectDatabase({ homeDir, projectName });
      const ready = openProjectStore({ projectFolder, create: false });
      try { expect(ready.db.all(sql`select content_hash from asset_file`)).toEqual([{
        content_hash: createHash('sha256').update('opaque reference').digest('hex'),
      }]); }
      finally { ready.close(); }
    });
  }

  it('keeps registration failure private, preserves its backup, and retries exactly once', async () => {
    const { homeDir, service, projectFolder, projectName } = await fixture();
    const folder = (await service.createInspirationFolder({ homeDir, projectName, name: 'References' })).folder;
    const original = openProjectStore({ projectFolder, create: false });
    original.db.run(sql`update project set asset_file_backfill_version = 0`);
    original.close();
    closeProjectStore({ projectFolder });
    const folderPath = path.join(projectFolder, folder.projectRelativePath);
    await fs.rename(folderPath, `${folderPath}.unavailable`);
    let backupPath: string | undefined;
    try {
      await service.migrateProjectDatabase({ homeDir, projectName });
      expect.fail('Registration must fail');
    } catch (error) {
      expect(error).toMatchObject({ code: 'PROJECT_ASSET_FILE_BACKFILL_FAILED',
        issues: expect.arrayContaining([expect.objectContaining({ location: expect.objectContaining({
          context: 'reference registration failed', filePath: expect.stringContaining('project-before-migration'),
        }) })]) });
      backupPath = (error as { issues: { location: { context?: string; filePath?: string } }[] }).issues
        .find((issue) => issue.location.context === 'reference registration failed')!.location.filePath;
    }
    expect((await fs.stat(backupPath!)).size).toBeGreaterThan(0);
    expect(() => openProjectStore({ projectFolder, create: false, lifetime: 'project' }))
      .toThrow(expect.objectContaining({ code: 'PROJECT_ASSET_FILE_BACKFILL_FAILED' }));
    await fs.rename(`${folderPath}.unavailable`, folderPath);
    await fs.writeFile(path.join(folderPath, 'reference.png'), 'opaque image bytes');
    const ready = openProjectStore({ projectFolder, create: false, lifetime: 'project' });
    expect(ready.db.get(sql`select asset_file_backfill_version from project`)).toEqual({ asset_file_backfill_version: 1 });
    const files = ready.db.all(sql`select * from asset_file`);
    const backups = path.join(projectFolder, '.renku/project-database-backups');
    const backupNames = await fs.readdir(backups);
    closeProjectStore({ projectFolder });
    const reopened = openProjectStore({ projectFolder, create: false, lifetime: 'project' });
    expect(reopened.db.all(sql`select * from asset_file`)).toEqual(files);
    expect(files).toEqual(expect.arrayContaining([expect.objectContaining({
      owner_key: `inspirationFolder:${folder.id}`, type: 'inspiration_image', media_kind: 'image',
      mime_type: 'image/png', size_bytes: Buffer.byteLength('opaque image bytes'),
      content_hash: createHash('sha256').update('opaque image bytes').digest('hex'),
      project_relative_path: `${folder.projectRelativePath}/reference.png`,
    })]));
    expect(await fs.readdir(backups)).toEqual(backupNames);
    expect(await fs.readFile(path.join(folderPath, 'reference.png'), 'utf8')).toBe('opaque image bytes');
    closeProjectStore({ projectFolder });
  });
});
