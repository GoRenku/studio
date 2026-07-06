import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ScreenplayCreateDocument } from '../../client/screenplay.js';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
  type ProjectDataService,
} from '../index.js';
import { resolveProjectDatabasePath, resolveProjectFolder } from '../files/project-paths.js';
import { resolveRenkuStorageRoot } from '../renku-config.js';
import {
  createCommandBuiltBlankMovieProject,
  writeConfig,
} from './project-data-fixtures.js';

const dialogueAudioProjectName = 'dialogue-audio-test';

interface DialogueAudioTemplate {
  projectFolder: string;
  databasePath: string;
}

export interface DialogueAudioReadyProject {
  homeDir: string;
  projectData: ProjectDataService;
  projectPath: string;
  sceneId: string;
  dialogueId: string;
}

let dialogueAudioTemplatePromise: Promise<DialogueAudioTemplate | null> | undefined;

export async function createDialogueAudioReadyProject(): Promise<
  DialogueAudioReadyProject | null
> {
  const template = await dialogueAudioTemplate();
  if (!template) {
    return null;
  }

  const homeDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'renku-scene-dialogue-audio-test-')
  );
  await writeConfig(homeDir, path.join(homeDir, 'projects'));
  const storageRoot = await resolveRenkuStorageRoot({ homeDir });
  await fs.mkdir(storageRoot, { recursive: true });
  const projectPath = resolveProjectFolder(storageRoot, dialogueAudioProjectName);
  await fs.cp(template.projectFolder, projectPath, {
    recursive: true,
    force: false,
    errorOnExist: true,
  });

  const databasePath = resolveProjectDatabasePath(projectPath);
  await assertPathExists(databasePath, 'copied dialogue audio project database');

  const projectData = createProjectDataService();
  await projectData.openCurrentProject({
    projectName: dialogueAudioProjectName,
    homeDir,
  });

  return {
    homeDir,
    projectData,
    projectPath,
    sceneId: 'scene_test0001',
    dialogueId: 'dialogue_urban_test',
  };
}

async function dialogueAudioTemplate(): Promise<DialogueAudioTemplate | null> {
  dialogueAudioTemplatePromise ??= buildDialogueAudioTemplate();
  return await dialogueAudioTemplatePromise;
}

async function buildDialogueAudioTemplate(): Promise<DialogueAudioTemplate | null> {
  const homeDir = await fs.mkdtemp(
    path.join(os.tmpdir(), `renku-dialogue-audio-template-${process.pid}-`)
  );
  await writeConfig(homeDir, path.join(homeDir, 'projects'));
  const projectData = createProjectDataService();
  const created = await createCommandBuiltBlankMovieProject({
    projectData,
    homeDir,
    projectName: dialogueAudioProjectName,
    title: 'Dialogue Audio Test',
  });
  if (!created) {
    return null;
  }

  await projectData.openCurrentProject({
    projectName: dialogueAudioProjectName,
    homeDir,
  });
  await projectData.applyCastOperations({
    homeDir,
    document: {
      kind: 'castOperations',
      operations: [
        {
          operation: 'castMember.add',
          castMember: {
            key: 'urban',
            handle: 'urban',
            name: 'Urban',
            role: 'cannon founder',
          },
        },
      ],
    },
    idGenerator: createDeterministicIdGenerator(),
  });
  await projectData.createScreenplay({
    homeDir,
    document: dialogueAudioScreenplayDocument(),
    idGenerator: createDeterministicIdGenerator(),
  });

  await assertPathExists(created.projectPath, 'dialogue audio template folder');
  await assertPathExists(created.databasePath, 'dialogue audio template database');
  return {
    projectFolder: created.projectPath,
    databasePath: created.databasePath,
  };
}

function dialogueAudioScreenplayDocument(): ScreenplayCreateDocument {
  return {
    kind: 'screenplayCreate',
    screenplay: {
      title: 'Dialogue Audio Test',
      logline: 'A founder tests a cannon and a conscience.',
    },
    cast: [],
    locations: [],
    acts: [
      {
        key: 'act-one',
        title: 'Act I',
        sequences: [
          {
            key: 'the-wall',
            title: 'The Wall',
            scenes: [
              {
                key: 'cannon-test',
                title: 'Cannon Test',
                setting: {
                  interiorExterior: 'EXT',
                  timeOfDay: 'DAWN',
                  locationIds: [],
                },
                blocks: [
                  {
                    dialogueId: 'dialogue_urban_test',
                    type: 'dialogue',
                    castMemberId: 'cast_test0001',
                    lines: ['Bronze has no temper. Men give it one.'],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

async function assertPathExists(filePath: string, description: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      throw new DialogueAudioTemplateFixtureError(
        `Expected ${description} to exist at ${filePath}.`
      );
    }
    throw error;
  }
}

class DialogueAudioTemplateFixtureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DialogueAudioTemplateFixtureError';
  }
}

function isNodeError(error: unknown): error is Error & { code: string } {
  return error instanceof Error && typeof (error as { code?: unknown }).code === 'string';
}
