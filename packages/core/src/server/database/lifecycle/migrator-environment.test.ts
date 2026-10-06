import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, expect, it, vi } from 'vitest';
import { migrateProjectDatabase } from './migrator.js';
import { PROJECT_DATABASE_PRE_MIGRATION_BACKUP_PATH_ENV } from './project-database-backups.js';

const child = vi.hoisted(() => vi.fn(() => ({ status: 0 as number | null, stdout: '', stderr: '', error: undefined as Error | undefined })));
vi.mock('node:child_process', () => ({ spawnSync: child }));
const previous = process.env[PROJECT_DATABASE_PRE_MIGRATION_BACKUP_PATH_ENV];
afterEach(() => {
  if (previous === undefined) { delete process.env[PROJECT_DATABASE_PRE_MIGRATION_BACKUP_PATH_ENV]; }
  else { process.env[PROJECT_DATABASE_PRE_MIGRATION_BACKUP_PATH_ENV] = previous; }
  child.mockClear();
});

it('removes an unrelated inherited backup for a new database', () => {
  process.env[PROJECT_DATABASE_PRE_MIGRATION_BACKUP_PATH_ENV] = '/unrelated/project.sqlite';
  const databasePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'renku-migration-env-')), 'project.sqlite');
  expect(migrateProjectDatabase(databasePath).preMigrationBackup).toBeNull();
  const options = child.mock.calls[0] as unknown as [string, string[], { env: Record<string, string | undefined> }];
  expect(options[2].env[PROJECT_DATABASE_PRE_MIGRATION_BACKUP_PATH_ENV]).toBeUndefined();
});

it('passes only the freshly verified backup for a populated database', () => {
  process.env[PROJECT_DATABASE_PRE_MIGRATION_BACKUP_PATH_ENV] = '/unrelated/project.sqlite';
  const databasePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'renku-migration-env-')), 'project.sqlite');
  const database = new Database(databasePath);
  database.exec('create table saved_work (id text)');
  database.close();
  const report = migrateProjectDatabase(databasePath);
  const options = child.mock.calls[0] as unknown as [string, string[], { env: Record<string, string | undefined> }];
  expect(options[2].env[PROJECT_DATABASE_PRE_MIGRATION_BACKUP_PATH_ENV]).toBe(report.preMigrationBackup!.backupPath);
});

it.each(['startup', 'exit'])('retains a verified backup and failure stage on child %s failure', (failure) => {
  const databasePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'renku-migration-failure-')), 'project.sqlite');
  const database = new Database(databasePath);
  database.exec("create table saved_work (document text); insert into saved_work values ('Opaque Ω');");
  database.close();
  child.mockReturnValueOnce({ status: failure === 'startup' ? null : 1,
    stdout: '', stderr: failure === 'exit' ? 'Synthetic SQL failure' : '',
    error: failure === 'startup' ? new Error('Synthetic child startup failure') : undefined });
  const stage = failure === 'startup' ? 'migration did not start' : 'SQL may have run';
  let caught;
  try { migrateProjectDatabase(databasePath); expect.fail('Migration must fail'); }
  catch (error) { caught = error; }
  expect(caught).toMatchObject({ code: failure === 'startup' ? 'PROJECT_DATA041' : 'PROJECT_DATA042',
    issues: expect.arrayContaining([expect.objectContaining({ location: expect.objectContaining({ context: stage }) })]),
    suggestion: expect.stringContaining('restore only into a clean database location') });
  const options = child.mock.calls[0] as unknown as [string, string[], { env: Record<string, string | undefined> }];
  const backup = new Database(options[2].env[PROJECT_DATABASE_PRE_MIGRATION_BACKUP_PATH_ENV]!, { readonly: true });
  try { expect(backup.prepare('select * from saved_work').all()).toEqual([{ document: 'Opaque Ω' }]); }
  finally { backup.close(); }
});
