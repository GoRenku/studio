import fs from 'node:fs/promises';
import path from 'node:path';
import { ProjectDataError } from '../project-data-error.js';
import type { ProjectCreateReport } from '../../client/index.js';
import { resolveRenkuStorageRoot } from '../renku-config.js';
import { migrateProjectDatabase } from '../database/lifecycle/migrator.js';
import { openProjectStore } from '../database/lifecycle/store.js';
import { copyProjectCoverImage } from '../files/cover-image-files.js';
import {
  PROJECT_COVER_IMAGE_FILE,
  RENKU_PROJECT_DIR,
  resolveProjectDatabasePath,
  resolveProjectFolder,
} from '../files/project-paths.js';
import { pathExists } from '../files/path-existence.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
} from '../entity-ids.js';
import {
  readProjectSetupOrThrow,
} from '../setup/reader.js';
import { writeProjectSetupRecords } from '../setup/writer.js';
import type {
  CreateProjectFromSetupInput,
} from '../project-data-service-contracts.js';

export async function createFromSetup(
  input: CreateProjectFromSetupInput
): Promise<ProjectCreateReport> {
  const setupResult = await readProjectSetupOrThrow(input.setupPath);
  const setup = setupResult.setup;
  const storageRoot = await resolveRenkuStorageRoot(input);
  await fs.mkdir(storageRoot, { recursive: true });

  const projectFolder = resolveProjectFolder(storageRoot, setup.project.name);
  if (await pathExists(projectFolder)) {
    throw new ProjectDataError(
      'PROJECT_DATA024',
      `Project folder already exists: ${projectFolder}`
    );
  }

  await fs.mkdir(path.join(projectFolder, RENKU_PROJECT_DIR), { recursive: true });
  migrateProjectDatabase(resolveProjectDatabasePath(projectFolder));
  const session = openProjectStore({ projectFolder, create: true });
  const ids = createUniqueIdAllocator(
    input.idGenerator ?? createRandomIdGenerator()
  );

  try {
    const now = new Date().toISOString();
    const coverFile = setupResult.coverPath ? PROJECT_COVER_IMAGE_FILE : null;
    const counts = await writeProjectSetupRecords(
      session,
      setup,
      ids,
      now,
      coverFile,
      projectFolder
    );
    const coverPath = await copyProjectCoverImage({
      coverPath: setupResult.coverPath,
      projectFolder,
    });

    return {
      projectName: setup.project.name,
      projectPath: projectFolder,
      databasePath: resolveProjectDatabasePath(projectFolder),
      coverPath,
      created: counts,
      warnings: setupResult.warnings,
    };
  } finally {
    session.close();
  }
}
