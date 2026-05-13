import fs from 'node:fs/promises';
import path from 'node:path';
import { createDiagnosticError } from '@gorenku/studio-diagnostics';
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
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
} from '../entity-ids.js';
import { readNarrativeStarterOrThrow } from '../narrative-starter/index.js';
import { projectSetupFromNarrativeStarter } from '../narrative-starter/to-project-setup.js';
import {
  readProjectSetupOrThrow,
} from '../setup/reader.js';
import { writeProjectSetupRecords } from '../setup/writer.js';
import type {
  CreateProjectFromNarrativeStarterInput,
  CreateProjectFromSetupInput,
  MigrateProjectDatabaseInput,
  ProjectDatabaseMigrationReport,
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
    const coverFile = input.coverPath ? PROJECT_COVER_IMAGE_FILE : null;
    const counts = await writeProjectSetupRecords(
      session,
      setup,
      ids,
      now,
      coverFile,
      projectFolder
    );
    const coverPath = await copyProjectCoverImage({
      coverPath: input.coverPath,
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

export async function createFromNarrativeStarter(
  input: CreateProjectFromNarrativeStarterInput
): Promise<ProjectCreateReport> {
  const starterResult = await readNarrativeStarterOrThrow(input.starterPath);
  const setup = projectSetupFromNarrativeStarter(starterResult.starter);
  const storageRoot = await resolveRenkuStorageRoot(input);
  await fs.mkdir(storageRoot, { recursive: true });

  const projectFolder = resolveProjectFolder(storageRoot, setup.project.name);
  if (await pathExists(projectFolder)) {
    throw new ProjectDataError(
      'NARRATIVE_STARTER050',
      `Project folder already exists: ${projectFolder}`,
      {
        issues: [
          createDiagnosticError(
            'NARRATIVE_STARTER050',
            `Project folder already exists: ${projectFolder}`,
            {
              filePath: input.starterPath,
              path: ['project', 'name'],
              context: 'narrative starter YAML',
            },
            'Choose a different project.name or remove the existing project folder.'
          ),
        ],
        suggestion:
          'Choose a different project name or remove the existing project folder.',
      }
    );
  }

  await fs.mkdir(path.join(projectFolder, RENKU_PROJECT_DIR), { recursive: true });
  migrateProjectDatabase(resolveProjectDatabasePath(projectFolder));
  const session = openProjectStore({ projectFolder, create: true });
  const ids = createUniqueIdAllocator(
    input.idGenerator ?? createRandomIdGenerator()
  );
  const starterCoverPath = starterResult.starter.project.coverFile
    ? path.resolve(
        path.dirname(input.starterPath),
        starterResult.starter.project.coverFile
      )
    : undefined;

  try {
    const now = new Date().toISOString();
    const coverFile = starterCoverPath ? PROJECT_COVER_IMAGE_FILE : null;
    const counts = await writeProjectSetupRecords(
      session,
      setup,
      ids,
      now,
      coverFile,
      projectFolder
    );
    const coverPath = await copyProjectCoverImage({
      coverPath: starterCoverPath,
      projectFolder,
    });

    return {
      projectName: setup.project.name,
      projectPath: projectFolder,
      databasePath: resolveProjectDatabasePath(projectFolder),
      coverPath,
      created: counts,
      warnings: starterResult.warnings,
    };
  } finally {
    session.close();
  }
}

export async function migrateProjectDatabaseForProject(
  input: MigrateProjectDatabaseInput
): Promise<ProjectDatabaseMigrationReport> {
  const storageRoot = await resolveRenkuStorageRoot(input);
  const projectFolder = resolveProjectFolder(storageRoot, input.projectName);
  const databasePath = resolveProjectDatabasePath(projectFolder);

  if (!(await pathExists(databasePath))) {
    throw new ProjectDataError(
      'PROJECT_DATA020',
      `Project database not found at ${databasePath}.`
    );
  }

  migrateProjectDatabase(databasePath);

  return {
    projectName: input.projectName,
    projectPath: projectFolder,
    databasePath,
  };
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.stat(targetPath);
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}
