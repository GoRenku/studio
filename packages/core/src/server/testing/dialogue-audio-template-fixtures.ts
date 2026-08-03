import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ScreenplayInput } from '../../client/screenplay/index.js';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
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
  sceneId: string;
  dialogueId: string;
}

export interface DialogueAudioReadyProject {
  homeDir: string;
  projectData: ReturnType<typeof createProjectDataService>;
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
    sceneId: template.sceneId,
    dialogueId: template.dialogueId,
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
  const screenplay = await projectData.createScreenplay({
    homeDir,
    projectName: dialogueAudioProjectName,
    screenplay: dialogueAudioScreenplayInput(),
    idGenerator: createDeterministicIdGenerator(),
  });

  await assertPathExists(created.projectPath, 'dialogue audio template folder');
  await assertPathExists(created.databasePath, 'dialogue audio template database');
  return {
    projectFolder: created.projectPath,
    databasePath: created.databasePath,
    sceneId: screenplay.generatedIdentities.find((identity) => identity.key === 'cannon-test')!.id,
    dialogueId: screenplay.generatedIdentities.find((identity) => identity.key === 'urban-dialogue')!.id,
  };
}

function dialogueAudioScreenplayInput(): ScreenplayInput {
  return {
    opening: [],
    scenes: [
      {
        key: 'cannon-test',
        heading: 'EXT. THE WALL - DAWN',
        title: 'Cannon Test',
        blocks: [
          {
            key: 'urban-dialogue',
            type: 'dialogue',
            characterName: 'URBAN',
            extensions: [],
            parts: [
              {
                key: 'urban-speech',
                type: 'speech',
                text: 'Bronze has no temper. Men give it one.',
              },
            ],
          },
        ],
      },
    ],
    sections: [
      { key: 'act-one', type: 'act', title: 'Act I' },
      { key: 'the-wall', type: 'sequence', title: 'The Wall' },
    ],
    structure: [
      { key: 'act-one-placement', content: { type: 'section', section: { key: 'act-one' } }, position: 0 },
      { key: 'the-wall-placement', parentSection: { key: 'act-one' }, content: { type: 'section', section: { key: 'the-wall' } }, position: 0 },
      { key: 'cannon-test-placement', parentSection: { key: 'the-wall' }, content: { type: 'scene', scene: { key: 'cannon-test' } }, position: 0 },
    ],
    references: [
      {
        key: 'urban-speaker',
        subject: { type: 'castMember', id: 'cast_test0001' },
        target: { type: 'dialogueCue', scene: { key: 'cannon-test' }, turn: { key: 'urban-dialogue' } },
        role: 'speaker',
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
