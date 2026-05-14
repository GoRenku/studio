import fs from 'node:fs/promises';
import path from 'node:path';
import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import type { ProjectCreateReport } from '../../client/index.js';
import { ProjectDataError } from '../project-data-error.js';
import { resolveRenkuStorageRoot } from '../renku-config.js';
import { migrateProjectDatabase } from '../database/lifecycle/migrator.js';
import { openProjectStore } from '../database/lifecycle/store.js';
import { copyProjectCoverImage } from '../files/cover-image-files.js';
import { pathExists } from '../files/path-existence.js';
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
import { writeProjectSetupRecords } from '../setup/writer.js';
import type { CreateProjectFromNarrativeStarterInput } from '../project-data-service-contracts.js';

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
