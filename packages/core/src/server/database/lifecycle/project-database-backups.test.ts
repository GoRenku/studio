import Database from 'better-sqlite3';
import fs from 'node:fs/promises';
import { closeSync, fsyncSync, openSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  PROJECT_DATABASE_PRE_MIGRATION_BACKUP_PATH_ENV,
  createProjectDatabasePreMigrationBackup,
  prepareProjectDatabaseMigrationTarget,
  validateProjectDatabasePreMigrationBackup,
} from './project-database-backups.js';
import { currentProjectStoreSchemaGeneration } from './project-store-schema-generation.js';

describe('project database pre-migration backups', () => {
  let projectFolder: string;
  let previousBackupPathEnv: string | undefined;

  beforeEach(async () => {
    projectFolder = await fs.mkdtemp(
      path.join(os.tmpdir(), 'renku-project-database-backups-')
    );
    await fs.mkdir(path.join(projectFolder, '.renku'));
    previousBackupPathEnv =
      process.env[PROJECT_DATABASE_PRE_MIGRATION_BACKUP_PATH_ENV];
    delete process.env[PROJECT_DATABASE_PRE_MIGRATION_BACKUP_PATH_ENV];
  });

  afterEach(() => {
    if (previousBackupPathEnv === undefined) {
      delete process.env[PROJECT_DATABASE_PRE_MIGRATION_BACKUP_PATH_ENV];
    } else {
      process.env[PROJECT_DATABASE_PRE_MIGRATION_BACKUP_PATH_ENV] =
        previousBackupPathEnv;
    }
  });

  it('returns no backup report when the project database does not exist yet', () => {
    expect(
      createProjectDatabasePreMigrationBackup(projectDatabasePath())
    ).toBeNull();
  });

  it('returns no backup for an empty new database file', async () => {
    await fs.writeFile(projectDatabasePath(), '');
    expect(createProjectDatabasePreMigrationBackup(projectDatabasePath())).toBeNull();
  });

  it('uses native writable file flushes without truncating populated data', () => {
    createProjectDatabase({ schemaGeneration: 34, projectTitle: 'Native flush' });
    if (process.platform === 'win32') {
      const oldHandle = openSync(projectDatabasePath(), 'r');
      try { expect(() => fsyncSync(oldHandle)).toThrow(); }
      finally { closeSync(oldHandle); }
    }
    const report = createProjectDatabasePreMigrationBackup(projectDatabasePath())!;
    const backup = new Database(report.backupPath, { readonly: true });
    try { expect(readProjectTitle(backup)).toBe('Native flush'); }
    finally { backup.close(); }
  });

  for (const field of ['databasePath', 'targetSchemaGeneration', 'backupDatabaseSizeBytes', 'createdAt']) {
    it(`blocks a supplied backup with invalid ${field}`, async () => {
      createProjectDatabase({ schemaGeneration: 34, projectTitle: 'Supplied evidence' });
      const report = createProjectDatabasePreMigrationBackup(projectDatabasePath())!;
      const metadata = JSON.parse(await fs.readFile(report.metadataPath, 'utf8'));
      metadata[field] = field === 'databasePath' ? '/unrelated/project.sqlite' : -1;
      await fs.writeFile(report.metadataPath, JSON.stringify(metadata));
      expect(() => validateProjectDatabasePreMigrationBackup({ databasePath: projectDatabasePath(), backupPath: report.backupPath }))
        .toThrow(expect.objectContaining({ code: 'PROJECT_DATA047', issues: expect.any(Array) }));
    });
  }

  it.each(['missing metadata', 'truncated metadata', 'missing backup', 'truncated backup', 'same-size corruption', 'wrong source generation'])
    ('rejects supplied evidence with %s and leaves source bytes unchanged', async (failure) => {
      createProjectDatabase({ schemaGeneration: 34, projectTitle: 'Supplied evidence' });
      const original = await fs.readFile(projectDatabasePath());
      const report = createProjectDatabasePreMigrationBackup(projectDatabasePath())!;
      if (failure === 'missing metadata') { await fs.rename(report.metadataPath, `${report.metadataPath}.retained`); }
      else if (failure === 'truncated metadata') { await fs.writeFile(report.metadataPath, '{'); }
      else if (failure === 'missing backup') { await fs.rename(report.backupPath, `${report.backupPath}.retained`); }
      else if (failure === 'truncated backup') { await fs.writeFile(report.backupPath, 'SQLite format 3'); }
      else if (failure === 'same-size corruption') { await fs.writeFile(report.backupPath, Buffer.alloc(report.backupDatabaseSizeBytes)); }
      else {
        const metadata = JSON.parse(await fs.readFile(report.metadataPath, 'utf8'));
        metadata.sourceSchemaGeneration = 35;
        await fs.writeFile(report.metadataPath, JSON.stringify(metadata));
      }
      expect(() => validateProjectDatabasePreMigrationBackup({ databasePath: projectDatabasePath(), backupPath: report.backupPath }))
        .toThrow(expect.objectContaining({ code: 'PROJECT_DATA047', issues: expect.any(Array) }));
      expect(await fs.readFile(projectDatabasePath())).toEqual(original);
    });

  it('rejects malformed SQLite without changing its bytes', async () => {
    const bytes = Buffer.from('not a SQLite database');
    await fs.writeFile(projectDatabasePath(), bytes);
    expect(() => createProjectDatabasePreMigrationBackup(projectDatabasePath()))
      .toThrow(expect.objectContaining({ code: 'PROJECT_DATA046' }));
    expect(await fs.readFile(projectDatabasePath())).toEqual(bytes);
  });

  it('creates and verifies a SQLite backup with sidecar metadata', async () => {
    createProjectDatabase({
      schemaGeneration: 34,
      projectTitle: 'Before migration',
    });

    const report = createProjectDatabasePreMigrationBackup(projectDatabasePath());

    expect(report).toMatchObject({
      backupPath: expect.stringContaining(
        path.join('.renku', 'project-database-backups')
      ),
      metadataPath: expect.stringContaining(
        path.join('.renku', 'project-database-backups')
      ),
      sourceSchemaGeneration: 34,
      targetSchemaGeneration: currentProjectStoreSchemaGeneration(),
      sourceDatabaseSizeBytes: expect.any(Number),
      backupDatabaseSizeBytes: expect.any(Number),
    });
    expect(report?.backupPath).toMatch(
      /project-before-migration-from-generation-34-to-\d+-\d{8}T\d{9}Z-[a-f0-9]{6}\.sqlite$/
    );

    const backup = new Database(report!.backupPath, {
      readonly: true,
      fileMustExist: true,
    });
    try {
      expect(backup.pragma('quick_check', { simple: true })).toBe('ok');
      expect(backup.pragma('user_version', { simple: true })).toBe(34);
      expect(readProjectTitle(backup)).toBe('Before migration');
    } finally {
      backup.close();
    }

    const metadata = JSON.parse(
      await fs.readFile(report!.metadataPath, 'utf8')
    ) as Record<string, unknown>;
    expect(metadata).toMatchObject({
      kind: 'projectDatabasePreMigrationBackup',
      databasePath: projectDatabasePath(),
      backupPath: report!.backupPath,
      sourceSchemaGeneration: 34,
      targetSchemaGeneration: currentProjectStoreSchemaGeneration(),
      verification: {
        opened: true,
        quickCheck: 'ok',
      },
    });
  });

  it('validates a supplied backup and does not create a duplicate safety backup', async () => {
    createProjectDatabase({
      schemaGeneration: 34,
      projectTitle: 'Safety gate',
    });
    const firstReport = createProjectDatabasePreMigrationBackup(
      projectDatabasePath()
    );
    process.env[PROJECT_DATABASE_PRE_MIGRATION_BACKUP_PATH_ENV] =
      firstReport!.backupPath;

    const prepared = prepareProjectDatabaseMigrationTarget(projectDatabasePath());

    expect(prepared).toEqual(firstReport);
    await expect(backupSqliteFiles()).resolves.toEqual([firstReport!.backupPath]);
  });

  it('includes committed WAL work and excludes an uncommitted writer', () => {
    createProjectDatabase({ schemaGeneration: 34, projectTitle: 'Initial' });
    const writer = new Database(projectDatabasePath());
    writer.pragma('journal_mode = WAL');
    writer.pragma('wal_autocheckpoint = 0');
    const reader = new Database(projectDatabasePath(), { readonly: true });
    reader.exec('begin');
    expect(readProjectTitle(reader)).toBe('Initial');
    writer.prepare('update project set title = ?').run("Committed Ω ' quotation");
    writer.exec('begin immediate');
    writer.prepare('update project set title = ?').run('Uncommitted');
    try {
      const report = createProjectDatabasePreMigrationBackup(projectDatabasePath())!;
      const backup = new Database(report.backupPath, { readonly: true, fileMustExist: true });
      try {
        expect(readProjectTitle(backup)).toBe("Committed Ω ' quotation");
        expect(backup.pragma('quick_check', { simple: true })).toBe('ok');
        expect(readProjectTitle(reader)).toBe('Initial');
      } finally { backup.close(); }
    } finally {
      writer.exec('rollback');
      reader.exec('rollback');
      reader.close();
      writer.close();
    }
  });

  it('never overwrites an earlier verified backup', async () => {
    createProjectDatabase({ schemaGeneration: 34, projectTitle: 'First' });
    const first = createProjectDatabasePreMigrationBackup(projectDatabasePath())!;
    const bytes = await fs.readFile(first.backupPath);
    const second = createProjectDatabasePreMigrationBackup(projectDatabasePath())!;
    expect(second.backupPath).not.toBe(first.backupPath);
    expect(await fs.readFile(first.backupPath)).toEqual(bytes);
  });

  it('creates a safety backup when Drizzle Kit is invoked directly', async () => {
    createProjectDatabase({
      schemaGeneration: 34,
      projectTitle: 'Direct migrate',
    });

    const report = prepareProjectDatabaseMigrationTarget(projectDatabasePath());

    expect(report).toMatchObject({
      backupPath: expect.stringContaining('project-before-migration'),
      sourceSchemaGeneration: 34,
    });
    await expect(backupSqliteFiles()).resolves.toEqual([report!.backupPath]);
  });

  it('rejects an invalid supplied backup before migration starts', async () => {
    createProjectDatabase({
      schemaGeneration: 34,
      projectTitle: 'Invalid backup',
    });
    const invalidBackupPath = path.join(
      projectFolder,
      '.renku',
      'project-database-backups',
      'invalid.sqlite'
    );
    await fs.mkdir(path.dirname(invalidBackupPath), { recursive: true });
    await fs.writeFile(invalidBackupPath, 'not sqlite', 'utf8');

    expect(() =>
      validateProjectDatabasePreMigrationBackup({
        databasePath: projectDatabasePath(),
        backupPath: invalidBackupPath,
      })
    ).toThrow(
      expect.objectContaining({
        code: 'PROJECT_DATA047',
      })
    );
  });

  it('fails with a structured error when the backup directory cannot be created', async () => {
    createProjectDatabase({
      schemaGeneration: 34,
      projectTitle: 'Blocked backup',
    });
    await fs.writeFile(
      path.join(projectFolder, '.renku', 'project-database-backups'),
      'not a directory',
      'utf8'
    );

    expect(() =>
      createProjectDatabasePreMigrationBackup(projectDatabasePath())
    ).toThrow(
      expect.objectContaining({
        code: 'PROJECT_DATA046',
      })
    );
  });

  function projectDatabasePath(): string {
    return path.join(projectFolder, '.renku', 'project.sqlite');
  }

  function createProjectDatabase(input: {
    schemaGeneration: number;
    projectTitle: string;
  }): void {
    const sqlite = new Database(projectDatabasePath());
    try {
      sqlite.exec(`
        create table project (
          id text primary key,
          title text not null
        );
        insert into project (id, title) values ('project_a', '${input.projectTitle}');
      `);
      sqlite.pragma(`user_version = ${input.schemaGeneration}`);
    } finally {
      sqlite.close();
    }
  }

  function readProjectTitle(sqlite: Database.Database): string {
    const row = sqlite
      .prepare('select title from project where id = ?')
      .get('project_a') as { title: string };
    return row.title;
  }

  async function backupSqliteFiles(): Promise<string[]> {
    const backupDir = path.join(projectFolder, '.renku', 'project-database-backups');
    const entries = await fs.readdir(backupDir);
    return entries
      .filter((entry) => entry.endsWith('.sqlite'))
      .map((entry) => path.join(backupDir, entry))
      .sort();
  }
});
