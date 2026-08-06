import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it, vi } from 'vitest';
import { createDeterministicIdGenerator } from '../entity-ids.js';
import { writeConfig } from '../testing/project-data-fixtures.js';

vi.mock('../database/access/project-settings.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('../database/access/project-settings.js')
  >();
  return {
    ...original,
    insertProjectSettingsRecord: () => {
      throw new Error('forced Project Settings insertion failure');
    },
  };
});

import { createMovieProject } from './create-movie-project.js';

describe('createMovieProject Project Settings transaction', () => {
  it('rolls back all Project rows when settings initialization fails', async () => {
    const homeDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'renku-create-settings-rollback-')
    );
    const storageRoot = path.join(homeDir, 'projects');
    await writeConfig(homeDir, storageRoot);

    await expect(
      createMovieProject({
        homeDir,
        projectName: 'settings-rollback',
        title: 'Settings Rollback',
        idGenerator: createDeterministicIdGenerator(),
      })
    ).rejects.toThrow('forced Project Settings insertion failure');

    const database = new Database(
      path.join(storageRoot, 'settings-rollback', '.renku', 'project.sqlite'),
      { readonly: true }
    );
    try {
      for (const table of [
        'project',
        'project_locale',
        'project_settings',
        'screenplay',
      ]) {
        expect(
          database.prepare(`select count(*) as count from ${table}`).get()
        ).toEqual({ count: 0 });
      }
    } finally {
      database.close();
    }
  });
});
