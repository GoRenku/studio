import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  closeProjectStore,
  openProjectStore,
} from './store.js';

describe('openProjectStore', () => {
  it('keeps project-lifetime SQLite sessions open until explicitly closed', async () => {
    const projectFolder = await createProjectFolder();
    createCurrentProjectDatabase(projectFolder);

    const first = openProjectStore({
      projectFolder,
      create: false,
      lifetime: 'project',
    });
    const second = openProjectStore({
      projectFolder,
      create: false,
      lifetime: 'project',
    });

    expect(second).toBe(first);

    first.close();
    const afterCallerClose = openProjectStore({
      projectFolder,
      create: false,
      lifetime: 'project',
    });

    expect(afterCallerClose).toBe(first);

    closeProjectStore({ projectFolder });
    const afterOwnerClose = openProjectStore({
      projectFolder,
      create: false,
      lifetime: 'project',
    });

    expect(afterOwnerClose).not.toBe(first);
    closeProjectStore({ projectFolder });
  });

  it('rejects a database without Drizzle migration metadata', async () => {
    const projectFolder = await createProjectFolder();
    const setup = new Database(projectDatabasePath(projectFolder));
    setup.exec('create table project (id text primary key)');
    setup.close();

    expect(() =>
      openProjectStore({
        projectFolder,
        create: false,
      })
    ).toThrow(
      expect.objectContaining({
        code: 'PROJECT_DATA044',
      })
    );
  });

  it('rejects an unversioned Drizzle database', async () => {
    const projectFolder = await createProjectFolder();
    createProjectDatabaseWithSchemaGeneration(projectFolder, 0);

    expect(() =>
      openProjectStore({
        projectFolder,
        create: false,
      })
    ).toThrow(
      expect.objectContaining({
        code: 'PROJECT_DATA044',
      })
    );
  });

  it('rejects a mismatched project store schema generation', async () => {
    const projectFolder = await createProjectFolder();
    createProjectDatabaseWithSchemaGeneration(projectFolder, 1);

    expect(() =>
      openProjectStore({
        projectFolder,
        create: false,
      })
    ).toThrow(
      expect.objectContaining({
        code: 'PROJECT_DATA044',
      })
    );
  });

  it('rejects corrupt SQLite files with a structured project data error', async () => {
    const projectFolder = await createProjectFolder();
    await fs.writeFile(projectDatabasePath(projectFolder), 'not sqlite', 'utf8');

    expect(() =>
      openProjectStore({
        projectFolder,
        create: false,
      })
    ).toThrow(
      expect.objectContaining({
        code: 'PROJECT_DATA044',
      })
    );
  });
});

async function createProjectFolder(): Promise<string> {
  const projectFolder = await fs.mkdtemp(
    path.join(os.tmpdir(), 'renku-project-store-')
  );
  await fs.mkdir(path.join(projectFolder, '.renku'));
  return projectFolder;
}

function projectDatabasePath(projectFolder: string): string {
  return path.join(projectFolder, '.renku', 'project.sqlite');
}

function createCurrentProjectDatabase(projectFolder: string): void {
  createProjectDatabaseWithSchemaGeneration(projectFolder, 11);
}

function createProjectDatabaseWithSchemaGeneration(
  projectFolder: string,
  schemaGeneration: number
): void {
  const setup = new Database(projectDatabasePath(projectFolder));
  setup.exec(`
    create table __drizzle_migrations (
      id integer primary key,
      hash text not null,
      created_at numeric
    );
    insert into __drizzle_migrations (hash, created_at)
      values ('test', 1);
  `);
  setup.pragma(`user_version = ${schemaGeneration}`);
  setup.close();
}
