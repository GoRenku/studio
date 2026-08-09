import fs from 'node:fs/promises';
import path from 'node:path';
import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import {
  DEFAULT_PROJECT_LOCALE_TAG,
  SUPPORTED_PROJECT_LOCALES,
  type ProjectCreateReport,
  type ProjectCounts,
} from '../../client/index.js';
import { insertProjectRecord } from '../database/access/project.js';
import { migrateProjectDatabase } from '../database/lifecycle/migrator.js';
import { openProjectStore } from '../database/lifecycle/store.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
} from '../entity-ids.js';
import { ensureScreenplaySingleton } from '../screenplay/persistence/screenplay.js';
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
import { DEFAULT_MOVIE_PROJECT_ASPECT_RATIO } from '../database/access/project-information.js';
import { insertProjectLocaleRecords } from '../database/access/project-locales.js';
import { insertProjectSettingsRecord } from '../database/access/project-settings.js';
import { validateProjectName } from './project-name-validation.js';
import {
  DEFAULT_PROJECT_SETTINGS,
  serializeProjectSettings,
} from '../project-settings/document.js';

export async function createMovieProject(
  input: CreateMovieProjectInput
): Promise<ProjectCreateReport> {
  validateProjectTitle(input.title);
  validateProjectName(input.projectName);
  const defaultLocale = SUPPORTED_PROJECT_LOCALES.find(
    (locale) => locale.localeTag === DEFAULT_PROJECT_LOCALE_TAG
  );
  if (!defaultLocale) {
    throw new ProjectDataError(
      'PROJECT_DATA050',
      `Default project locale ${DEFAULT_PROJECT_LOCALE_TAG} is missing from the supported catalog.`
    );
  }
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
      `Project folder already exists: ${projectFolder}`,
      {
        issues: [
          createDiagnosticError(
            'PROJECT_DATA024',
            `Folder name is already in use: ${input.projectName}`,
            { path: ['projectName'], context: 'Project creation' },
            'Choose another Folder name.'
          ),
        ],
        suggestion: 'Choose another Folder name.',
      }
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
      const transactionSession = { ...session, db: tx };
      insertProjectRecord(
        transactionSession,
        {
          id: ids('project'),
          projectName: input.projectName,
          title: input.title,
          logline: input.logline ?? null,
          aspectRatio: input.aspectRatio ?? DEFAULT_MOVIE_PROJECT_ASPECT_RATIO,
          synopsis: input.synopsis ?? null,
          coverFile: null,
          createdAt: now,
          updatedAt: now,
        }
      );
      ensureScreenplaySingleton(transactionSession);
      insertProjectSettingsRecord(
        transactionSession,
        serializeProjectSettings(DEFAULT_PROJECT_SETTINGS)
      );
      insertProjectLocaleRecords(transactionSession, [
        {
          id: ids('locale'),
          localeTag: DEFAULT_PROJECT_LOCALE_TAG,
          displayName: defaultLocale.displayName,
          isBase: true,
          supportsAudio: true,
          supportsSubtitles: true,
          position: 0,
        },
      ]);
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
    languages: 1,
    castMembers: 0,
    locations: 0,
    props: 0,
    acts: 0,
    sequences: 0,
    scenes: 0,
  };
}

function validateProjectTitle(title: string): void {
  if (title.trim() === '') {
    throw new ProjectDataError(
      'PROJECT_DATA050',
      'Project title must not be blank.',
      {
        issues: [
          createDiagnosticError(
            'PROJECT_DATA050',
            'Project title is required.',
            { path: ['title'], context: 'Project creation' },
            'Enter a Project title.'
          ),
        ],
        suggestion: 'Enter a Project title.',
      }
    );
  }
}
