import fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { ProjectCreateReport } from '../../client/index.js';
import type { ScreenplayInput } from '../../client/screenplay/index.js';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
} from '../index.js';
import { replaceProjectLocaleRecords } from '../database/access/project-locales.js';
import { openProjectStore } from '../database/lifecycle/store.js';

type ProjectDataService = ReturnType<typeof createProjectDataService>;

export async function runCreateOrSkip<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Could not locate the bindings file')
    ) {
      console.warn('Skipping project SQLite assertion because native bindings are not built.');
      return null;
    }
    throw error;
  }
}

export async function writeConfig(homeDir: string, storageRoot: string): Promise<void> {
  const configDir = path.join(homeDir, '.config', 'renku');
  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(
    path.join(configDir, 'config.yaml'),
    `version: 0.1.0\nstorageRoot: ${storageRoot}\n`,
    'utf8'
  );
}

export async function createBlankMovieProject(input: {
  homeDir: string;
  projectData?: ProjectDataService;
  projectName?: string;
  title?: string;
}): Promise<ProjectCreateReport | null> {
  const projectData = input.projectData ?? createProjectDataService();
  if (input.projectName !== undefined || input.title !== undefined) {
    return await createCommandBuiltBlankMovieProject({ ...input, projectData });
  }
  const { createIsolatedBlankMovieProjectFromTemplate } = await import(
    './movie-project-template-fixtures.js'
  );
  return await createIsolatedBlankMovieProjectFromTemplate({
    homeDir: input.homeDir,
    projectData,
  });
}

export async function createCommandBuiltBlankMovieProject(input: {
  homeDir: string;
  projectData?: ProjectDataService;
  projectName?: string;
  title?: string;
}): Promise<ProjectCreateReport | null> {
  const projectData = input.projectData ?? createProjectDataService();
  return await runCreateOrSkip(
    projectData.createMovieProject({
      projectName: input.projectName ?? 'blank-movie',
      title: input.title ?? 'Blank Movie',
      homeDir: input.homeDir,
      idGenerator: createDeterministicIdGenerator(),
    })
  );
}

export async function createSampleMovieProject(input: {
  homeDir: string;
  projectData?: ProjectDataService;
}): Promise<ProjectCreateReport | null> {
  const projectData = input.projectData ?? createProjectDataService();
  const { createIsolatedSampleMovieProjectFromTemplate } = await import(
    './movie-project-template-fixtures.js'
  );
  return await createIsolatedSampleMovieProjectFromTemplate({
    homeDir: input.homeDir,
    projectData,
  });
}

export async function createCommandBuiltSampleMovieProject(input: {
  homeDir: string;
  projectData?: ProjectDataService;
}): Promise<ProjectCreateReport | null> {
  const projectData = input.projectData ?? createProjectDataService();
  const created = await runCreateOrSkip(
    projectData.createMovieProject({
      projectName: 'constantinople',
      title: 'Preparation of the Siege',
      logline: 'A documentary about preparation before 1453.',
      synopsis: 'A documentary project synopsis stored in SQLite.',
      aspectRatio: '16:9',
      homeDir: input.homeDir,
      idGenerator: createDeterministicIdGenerator(),
    })
  );
  if (!created) {
    return null;
  }

  seedProjectInformationTables(created.projectPath);
  await projectData.openCurrentProject({
    projectName: 'constantinople',
    homeDir: input.homeDir,
  });
  await projectData.applyCastOperations({
    homeDir: input.homeDir,
    document: {
      kind: 'castOperations',
      operations: [
        {
          operation: 'castMember.add',
          castMember: {
            key: 'narrator',
            handle: 'narrator',
            name: 'Narrator',
            isVoiceOver: true,
            role: 'voiceover',
          },
        },
        {
          operation: 'castMember.add',
          castMember: {
            key: 'mehmed-ii',
            handle: 'mehmed-ii',
            name: 'Mehmed II',
            role: 'protagonist',
          },
        },
      ],
    },
    idGenerator: createDeterministicIdGenerator(),
  });
  await projectData.applyLocationOperations({
    homeDir: input.homeDir,
    document: {
      kind: 'locationOperations',
      operations: [
        {
          operation: 'location.add',
          location: {
            key: 'council-chamber',
            handle: 'council-chamber',
            name: "Mehmed's council chamber",
            description: 'Formal Ottoman planning room with maps and oil lamps.',
          },
        },
      ],
    },
    idGenerator: createDeterministicIdGenerator(),
  });
  await projectData.createScreenplay({
    homeDir: input.homeDir,
    projectName: 'constantinople',
    screenplay: sampleScreenplayInput(),
    idGenerator: createDeterministicIdGenerator(),
  });
  return created;
}

export function sampleScreenplayInput(): ScreenplayInput {
  return {
    opening: [],
    scenes: [
      {
        key: 'throne-city',
        heading: "INT. MEHMED'S COUNCIL CHAMBER - NIGHT",
        title: 'A Throne Facing an Ancient City',
        blocks: [
          {
            key: 'studies-map',
            type: 'action',
            text: 'Mehmed studies the city map.',
          },
        ],
      },
    ],
    sections: [
      { key: 'act-one', type: 'act', title: 'Act I' },
      { key: 'young-sultan', type: 'sequence', title: "The Young Sultan's Obsession", description: 'Mehmed turns conquest into policy.' },
    ],
    structure: [
      { key: 'act-one-placement', content: { type: 'section', section: { key: 'act-one' } }, position: 0 },
      { key: 'young-sultan-placement', parentSection: { key: 'act-one' }, content: { type: 'section', section: { key: 'young-sultan' } }, position: 0 },
      { key: 'throne-city-placement', parentSection: { key: 'young-sultan' }, content: { type: 'scene', scene: { key: 'throne-city' } }, position: 0 },
    ],
    references: [
      { key: 'location-setting', subject: { type: 'location', id: 'location_test0001' }, target: { type: 'scene', scene: { key: 'throne-city' } }, role: 'setting' },
      { key: 'mehmed-presence', subject: { type: 'castMember', id: 'cast_test0002' }, target: { type: 'block', scene: { key: 'throne-city' }, block: { key: 'studies-map' } }, role: 'presence' },
    ],
  };
}

export function tableColumns(database: Database.Database, tableName: string): string[] {
  return database
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .map((row) => (row as { name: string }).name);
}

export function readAssetFileMetadata(
  databasePath: string,
  assetId: string
): { contentHash: string | null; sizeBytes: number | null; updatedAt: string } {
  const database = new Database(databasePath, { readonly: true });
  try {
    const row = database
      .prepare(
        `select content_hash as contentHash, size_bytes as sizeBytes,
          updated_at as updatedAt
         from asset_file
         where asset_id = ?`
      )
      .get(assetId) as
      | { contentHash: string | null; sizeBytes: number | null; updatedAt: string }
      | undefined;
    if (!row) {
      throw new Error(`Asset file was not found for asset ${assetId}.`);
    }
    return row;
  } finally {
    database.close();
  }
}

function seedProjectInformationTables(projectFolder: string): void {
  const session = openProjectStore({ projectFolder, create: false });
  try {
    session.db.transaction((tx) => {
      const transactionSession = { ...session, db: tx };
      replaceProjectLocaleRecords(transactionSession, [
        {
          id: 'locale_test0001',
          localeTag: 'en-US',
          displayName: 'English',
          isBase: true,
          supportsAudio: true,
          supportsSubtitles: true,
          position: 1,
        },
        {
          id: 'locale_test0002',
          localeTag: 'tr-TR',
          displayName: 'Turkish',
          isBase: false,
          supportsAudio: true,
          supportsSubtitles: true,
          position: 2,
        },
      ]);
    });
  } finally {
    session.close();
  }
}
