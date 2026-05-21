import fs from 'node:fs/promises';
import path from 'node:path';
import type { ProjectCreateReport, ProjectCounts } from '../../client/index.js';
import { insertProjectRecord } from '../database/access/project.js';
import { migrateProjectDatabase } from '../database/lifecycle/migrator.js';
import { openProjectStore } from '../database/lifecycle/store.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
} from '../entity-ids.js';
import {
  RENKU_PROJECT_DIR,
  isPathInside,
  resolveProjectDatabasePath,
  resolveProjectFolder,
} from '../files/project-paths.js';
import { pathExists } from '../files/path-existence.js';
import { ProjectDataError } from '../project-data-error.js';
import { resolveRenkuStorageRoot } from '../renku-config.js';
import type { CreateMovieProjectInput } from '../project-data-service-contracts.js';

export async function createMovieProject(
  input: CreateMovieProjectInput
): Promise<ProjectCreateReport> {
  validateProjectName(input.projectName);
  const storageRoot = await resolveRenkuStorageRoot(input);
  await fs.mkdir(storageRoot, { recursive: true });

  const projectFolder = resolveProjectFolder(storageRoot, input.projectName);
  if (!isPathInside(storageRoot, projectFolder)) {
    throw new ProjectDataError(
      'PROJECT_DATA025',
      `Project folder must stay inside the configured storage root: ${projectFolder}`
    );
  }
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
    session.db.transaction((tx) => {
      insertProjectRecord(
        { ...session, db: tx },
        {
          id: ids('project'),
          name: input.projectName,
          title: input.title,
          type: 'standaloneMovie',
          logline: input.logline,
          aspectRatio: input.aspectRatio,
          summary: input.summary,
          coverFile: null,
          createdAt: now,
          updatedAt: now,
        }
      );
    });

    return {
      projectName: input.projectName,
      projectPath: projectFolder,
      databasePath: resolveProjectDatabasePath(projectFolder),
      coverPath: null,
      created: emptyMovieCounts(),
      warnings: [],
    };
  } finally {
    session.close();
  }
}

function emptyMovieCounts(): ProjectCounts {
  return {
    languages: 0,
    visualLanguageCategories: 0,
    visualLanguage: 0,
    castMembers: 0,
    continuityReferences: 0,
    episodes: 0,
    sequences: 0,
    scenes: 0,
    clips: 0,
  };
}

function validateProjectName(projectName: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(projectName)) {
    throw new ProjectDataError(
      'PROJECT_DATA025',
      'Project name must be kebab-case and contain only lowercase letters, numbers, and hyphens.'
    );
  }
}
