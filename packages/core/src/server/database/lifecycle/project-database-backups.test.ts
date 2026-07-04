import Database from 'better-sqlite3';
import fs from 'node:fs/promises';
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
