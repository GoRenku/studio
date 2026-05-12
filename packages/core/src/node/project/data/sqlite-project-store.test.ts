import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  closeProjectStore,
  openProjectStore,
} from './sqlite-project-store.js';

describe('openProjectStore', () => {
  it('keeps project-lifetime SQLite sessions open until explicitly closed', async () => {
    const projectFolder = await fs.mkdtemp(
      path.join(os.tmpdir(), 'renku-project-store-')
    );
    await fs.mkdir(path.join(projectFolder, '.renku'));
    const databasePath = path.join(projectFolder, '.renku', 'project.sqlite');
    const setup = new Database(databasePath);
    setup.exec('create table project (id text primary key)');
    setup.close();

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
});
