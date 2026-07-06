import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type {
  SceneShotListDocument,
  SceneShotVideoTake,
} from '../../client/index.js';
import { createDeterministicIdGenerator, createProjectDataService } from '../index.js';
import { resolveProjectDatabasePath, resolveProjectFolder } from '../files/project-paths.js';
import { resolveRenkuStorageRoot } from '../renku-config.js';
import { createSampleMovieProject, writeConfig } from './project-data-fixtures.js';

interface ShotVideoTakeProjectFileService {
  readCurrentProject(input: { homeDir?: string }): Promise<{
    projectFolder: string;
  } | null>;
}

export interface ShotVideoTakeSampleIds {
  sceneId: string;
  castMemberId: string;
  narratorCastMemberId: string;
  locationId: string;
}

export interface ShotVideoTakeLocationSheetFiles {
  primary: string;
}

export interface ShotVideoTakeTestProject {
  homeDir: string;
  projectData: ReturnType<typeof createProjectDataService>;
  sampleIds(): Promise<ShotVideoTakeSampleIds>;
  addVisualExtraCastMember(): Promise<string>;
  addCastToSceneNarrative(ids: {
    sceneId: string;
    extraCastMemberId: string;
    locationId: string;
  }): Promise<void>;
  addExtraLocationToSceneNarrative(ids: {
    sceneId: string;
    locationId: string;
  }): Promise<string>;
  writeShotList(
    ids: { sceneId: string; castMemberId: string; locationId: string },
    shotCount: number
  ): Promise<
    Awaited<
      ReturnType<ReturnType<typeof createProjectDataService>['writeSceneShotList']>
    > & { take: SceneShotVideoTake }
  >;
  writeProjectFile(projectRelativePath: string, contents: string): Promise<void>;
  writeLocationSheetImportFiles(
    projectPath: string,
    folderName: string
  ): Promise<ShotVideoTakeLocationSheetFiles>;
  projectFileExists(projectRelativePath: string): Promise<boolean>;
  sampleShotList(
    ids: { sceneId: string; castMemberId: string; locationId: string },
    shotCount: number
  ): SceneShotListDocument;
  lookbookDocument(): ReturnType<typeof shotVideoTakeLookbookDocument>;
}

type ShotVideoTakeWrittenShotList = Awaited<
  ReturnType<ShotVideoTakeTestProject['writeShotList']>
>;

type ShotVideoTakeTemplateName =
  | 'one-shot'
  | 'two-shot'
  | 'three-shot'
  | 'active-lookbook'
  | 'imported-first-frame'
  | 'selected-reference'
  | 'finalized';

interface ShotVideoTakeTemplate {
  name: ShotVideoTakeTemplateName;
  projectFolder: string;
  databasePath: string;
  ids: ShotVideoTakeSampleIds;
  written: ShotVideoTakeWrittenShotList;
  lookbookId?: string;
}

export interface ShotVideoTakeTemplateProject extends ShotVideoTakeTestProject {
  ids: ShotVideoTakeSampleIds;
  written: ShotVideoTakeWrittenShotList;
  lookbookId?: string;
}

let oneShotVideoTakeTemplatePromise: Promise<ShotVideoTakeTemplate> | undefined;
let twoShotVideoTakeTemplatePromise: Promise<ShotVideoTakeTemplate> | undefined;
let threeShotVideoTakeTemplatePromise: Promise<ShotVideoTakeTemplate> | undefined;
let activeLookbookShotVideoTakeTemplatePromise:
  | Promise<ShotVideoTakeTemplate>
  | undefined;
let importedFirstFrameShotVideoTakeTemplatePromise:
  | Promise<ShotVideoTakeTemplate>
  | undefined;
let selectedReferenceShotVideoTakeTemplatePromise:
  | Promise<ShotVideoTakeTemplate>
  | undefined;
let finalizedShotVideoTakeTemplatePromise:
  | Promise<ShotVideoTakeTemplate>
  | undefined;

export async function createShotVideoTakeTestProject(): Promise<ShotVideoTakeTestProject> {
  const homeDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'renku-shot-video-take-test-')
  );
  await writeConfig(homeDir, path.join(homeDir, 'projects'));
  const projectData = createProjectDataService();
  await createSampleMovieProject({ projectData, homeDir });
  return shotVideoTakeTestProjectForHome({ homeDir, projectData });
}

export async function createOneShotVideoTakeProject(): Promise<ShotVideoTakeTemplateProject> {
  oneShotVideoTakeTemplatePromise ??= buildShotVideoTakeTemplate({
    name: 'one-shot',
    shotCount: 1,
  });
  return await copyShotVideoTakeTemplate(await oneShotVideoTakeTemplatePromise);
}

export async function createTwoShotVideoTakeProject(): Promise<ShotVideoTakeTemplateProject> {
  twoShotVideoTakeTemplatePromise ??= buildShotVideoTakeTemplate({
    name: 'two-shot',
    shotCount: 2,
  });
  return await copyShotVideoTakeTemplate(await twoShotVideoTakeTemplatePromise);
}

export async function createThreeShotVideoTakeProject(): Promise<ShotVideoTakeTemplateProject> {
  threeShotVideoTakeTemplatePromise ??= buildShotVideoTakeTemplate({
    name: 'three-shot',
    shotCount: 3,
  });
  return await copyShotVideoTakeTemplate(await threeShotVideoTakeTemplatePromise);
}

export async function createActiveLookbookShotVideoTakeProject(): Promise<ShotVideoTakeTemplateProject> {
  activeLookbookShotVideoTakeTemplatePromise ??= buildShotVideoTakeTemplate({
    name: 'active-lookbook',
    shotCount: 1,
    activeLookbook: true,
  });
  return await copyShotVideoTakeTemplate(
    await activeLookbookShotVideoTakeTemplatePromise
  );
}

export async function createImportedFirstFrameShotVideoTakeProject(): Promise<ShotVideoTakeTemplateProject> {
  importedFirstFrameShotVideoTakeTemplatePromise ??= buildShotVideoTakeTemplate({
    name: 'imported-first-frame',
    shotCount: 1,
    importedFirstFrame: true,
  });
  return await copyShotVideoTakeTemplate(
    await importedFirstFrameShotVideoTakeTemplatePromise
  );
}

export async function createSelectedReferenceShotVideoTakeProject(): Promise<ShotVideoTakeTemplateProject> {
  selectedReferenceShotVideoTakeTemplatePromise ??= buildShotVideoTakeTemplate({
    name: 'selected-reference',
    shotCount: 1,
    activeLookbook: true,
    importedFirstFrame: true,
  });
  return await copyShotVideoTakeTemplate(
    await selectedReferenceShotVideoTakeTemplatePromise
  );
}

export async function createFinalizedShotVideoTakeProject(): Promise<ShotVideoTakeTemplateProject> {
  finalizedShotVideoTakeTemplatePromise ??= buildShotVideoTakeTemplate({
    name: 'finalized',
    shotCount: 2,
    finalized: true,
  });
  return await copyShotVideoTakeTemplate(await finalizedShotVideoTakeTemplatePromise);
}

function shotVideoTakeTestProjectForHome(input: {
  homeDir: string;
  projectData: ReturnType<typeof createProjectDataService>;
  sampleIds?: ShotVideoTakeSampleIds;
}): ShotVideoTakeTestProject {
  const { homeDir, projectData } = input;
  let sampleIdsPromise: Promise<ShotVideoTakeSampleIds> | undefined =
    input.sampleIds ? Promise.resolve(input.sampleIds) : undefined;

  return {
    homeDir,
    projectData,
    async sampleIds() {
      sampleIdsPromise ??= readShotVideoTakeSampleIds({ projectData, homeDir });
      return await sampleIdsPromise;
    },
    async addVisualExtraCastMember() {
      const report = await projectData.applyCastOperations({
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
      return report.generatedIds?.[0]?.id as string;
    },
    async addCastToSceneNarrative(ids) {
      const screenplay = await projectData.readScreenplay({ homeDir });
      const scene = screenplay.screenplay!.acts[0]!.sequences[0]!.scenes[0]!;
      await projectData.reviseScreenplayScene({
        homeDir,
        sceneId: ids.sceneId,
        document: {
          kind: 'screenplaySceneRevision',
          scene: {
            ...scene,
            blocks: [
              ...scene.blocks,
              {
                type: 'action',
                text: 'The narrator frames the siege from historical distance.',
                castMemberIds: [ids.extraCastMemberId],
                locationIds: [ids.locationId],
              },
            ],
          },
        },
      });
    },
    async addExtraLocationToSceneNarrative(ids) {
      await projectData.applyLocationOperations({
        homeDir,
        document: {
          kind: 'locationOperations',
          operations: [
            {
              operation: 'location.add',
              location: {
                key: 'ottoman-siege-camp',
                handle: 'ottoman-siege-camp',
                name: 'Ottoman Siege Camp',
                description: 'A smoky siege camp outside the city walls.',
              },
            },
          ],
        },
        idGenerator: createDeterministicIdGenerator(),
      });
      const screenplay = await projectData.readScreenplay({ homeDir });
      const scene = screenplay.screenplay!.acts[0]!.sequences[0]!.scenes[0]!;
      const location = screenplay.screenplay!.locations.find(
        (entry) => entry.handle === 'ottoman-siege-camp'
      );
      if (!location?.id) {
        throw new Error('Expected test location to be created.');
      }
      await projectData.reviseScreenplayScene({
        homeDir,
        sceneId: ids.sceneId,
        document: {
          kind: 'screenplaySceneRevision',
          scene: {
            ...scene,
            blocks: [
              ...scene.blocks,
              {
                type: 'action',
                text: 'The siege camp answers the city walls across the field.',
                castMemberIds: [],
                locationIds: [ids.locationId, location.id],
              },
            ],
          },
        },
      });
      return location.id as string;
    },
    async writeShotList(ids, shotCount) {
      const document = sampleShotVideoTakeShotList(ids, shotCount);
      const report = await projectData.writeSceneShotList({
        homeDir,
        document,
        idGenerator: createDeterministicIdGenerator(),
      });
      const takeReport = await projectData.createSceneShotVideoTake({
        homeDir,
        sceneId: ids.sceneId,
        shotListId: report.shotList.id,
        shotIds: document.shots.map((shot) => shot.shotId),
        idGenerator: createDeterministicIdGenerator(),
      });
      const take = takeReport.overview.take;
      return { ...report, take };
    },
    writeProjectFile(projectRelativePath, contents) {
      return writeShotVideoTakeProjectFile({
        projectData,
        homeDir,
        projectRelativePath,
        contents,
      });
    },
    async writeLocationSheetImportFiles(projectPath, folderName) {
      const folder = `generated/media/${folderName}`;
      await fs.mkdir(path.join(projectPath, folder), { recursive: true });
      const files = {
        primary: `${folder}/sheet.png`,
      };
      for (const [role, projectRelativePath] of Object.entries(files)) {
        await fs.writeFile(path.join(projectPath, projectRelativePath), role);
      }
      return files;
    },
    projectFileExists(projectRelativePath) {
      return shotVideoTakeProjectFileExists({
        projectData,
        homeDir,
        projectRelativePath,
      });
    },
    sampleShotList: sampleShotVideoTakeShotList,
    lookbookDocument: shotVideoTakeLookbookDocument,
  };
}

async function buildShotVideoTakeTemplate(input: {
  name: ShotVideoTakeTemplateName;
  shotCount: number;
  activeLookbook?: boolean;
  importedFirstFrame?: boolean;
  finalized?: boolean;
}): Promise<ShotVideoTakeTemplate> {
  const homeDir = await fs.mkdtemp(
    path.join(os.tmpdir(), `renku-shot-video-${input.name}-template-${process.pid}-`)
  );
  await writeConfig(homeDir, path.join(homeDir, 'projects'));
  const projectData = createProjectDataService();
  await createSampleMovieProject({ projectData, homeDir });
  const project = shotVideoTakeTestProjectForHome({ homeDir, projectData });
  const ids = await project.sampleIds();
  let written = await project.writeShotList(ids, input.shotCount);
  let lookbookId: string | undefined;

  if (input.activeLookbook) {
    const lookbook = await projectData.createLookbook({
      projectName: 'constantinople',
      homeDir,
      name: 'Imperial Wound',
      document: project.lookbookDocument(),
      idGenerator: createDeterministicIdGenerator(),
    });
    lookbookId = lookbook.lookbook.id;
    await projectData.selectLookbookForType({
      projectName: 'constantinople',
      homeDir,
      type: 'movie',
      lookbookId,
    });
  }

  if (input.importedFirstFrame) {
    const firstFramePath = 'generated/media/template-first-frame.png';
    await project.writeProjectFile(firstFramePath, 'template first frame');
    await projectData.importShotFirstFrame({
      homeDir,
      takeId: written.take.takeId,
      sourceProjectRelativePath: firstFramePath,
    });
  }

  if (input.finalized) {
    const promptSheetPath = 'generated/media/template-prompt-sheet.png';
    await project.writeProjectFile(promptSheetPath, 'template prompt sheet');
    await projectData.importShotVideoPromptSheet({
      homeDir,
      takeId: written.take.takeId,
      sourceProjectRelativePath: promptSheetPath,
      title: 'Template prompt sheet',
    });
    const videoPath = 'generated/media/template-final-take.mp4';
    await project.writeProjectFile(videoPath, 'template final video');
    await projectData.importShotVideoTake({
      homeDir,
      takeId: written.take.takeId,
      sourceProjectRelativePath: videoPath,
      title: 'Template final take',
    });
    written = {
      ...written,
      take: await projectData.readSceneShotVideoTake({
        homeDir,
        takeId: written.take.takeId,
      }),
    };
  }

  const currentProject = await projectData.readCurrentProject({ homeDir });
  if (!currentProject) {
    throw new Error('Expected current project for shot video take template.');
  }
  const databasePath = resolveProjectDatabasePath(currentProject.projectFolder);
  await assertPathExists(currentProject.projectFolder, 'shot video take template folder');
  await assertPathExists(databasePath, 'shot video take template database');

  return {
    name: input.name,
    projectFolder: currentProject.projectFolder,
    databasePath,
    ids,
    written,
    lookbookId,
  };
}

async function copyShotVideoTakeTemplate(
  template: ShotVideoTakeTemplate
): Promise<ShotVideoTakeTemplateProject> {
  await assertPathExists(template.projectFolder, 'shot video take template folder');
  await assertPathExists(template.databasePath, 'shot video take template database');

  const homeDir = await fs.mkdtemp(
    path.join(os.tmpdir(), `renku-shot-video-${template.name}-test-`)
  );
  await writeConfig(homeDir, path.join(homeDir, 'projects'));
  const storageRoot = await resolveRenkuStorageRoot({ homeDir });
  await fs.mkdir(storageRoot, { recursive: true });
  const projectFolder = resolveProjectFolder(storageRoot, 'constantinople');
  await fs.cp(template.projectFolder, projectFolder, {
    recursive: true,
    force: false,
    errorOnExist: true,
  });
  const databasePath = resolveProjectDatabasePath(projectFolder);
  await assertPathExists(projectFolder, 'copied shot video take project folder');
  await assertPathExists(databasePath, 'copied shot video take project database');

  const projectData = createProjectDataService();
  await projectData.openCurrentProject({
    homeDir,
    projectName: 'constantinople',
  });
  return {
    ...shotVideoTakeTestProjectForHome({
      homeDir,
      projectData,
      sampleIds: template.ids,
    }),
    ids: template.ids,
    written: template.written,
    lookbookId: template.lookbookId,
  };
}

async function readShotVideoTakeSampleIds(input: {
  projectData: ReturnType<typeof createProjectDataService>;
  homeDir: string;
}): Promise<ShotVideoTakeSampleIds> {
  const screenplay = await input.projectData.readScreenplay({
    homeDir: input.homeDir,
  });
  const scene = screenplay.screenplay!.acts[0]!.sequences[0]!.scenes[0]!;
  return {
    sceneId: scene.id as string,
    castMemberId: screenplay.screenplay!.cast[1]!.id as string,
    narratorCastMemberId: screenplay.screenplay!.cast[0]!.id as string,
    locationId: screenplay.screenplay!.locations[0]!.id as string,
  };
}

async function assertPathExists(filePath: string, description: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      throw new ShotVideoTakeTemplateFixtureError(
        `Expected ${description} to exist at ${filePath}.`
      );
    }
    throw error;
  }
}

class ShotVideoTakeTemplateFixtureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShotVideoTakeTemplateFixtureError';
  }
}

function isNodeError(error: unknown): error is Error & { code: string } {
  return error instanceof Error && typeof (error as { code?: unknown }).code === 'string';
}

export async function writeShotVideoTakeProjectFile(input: {
  projectData: ShotVideoTakeProjectFileService;
  homeDir: string;
  projectRelativePath: string;
  contents: string;
}): Promise<void> {
  const project = await input.projectData.readCurrentProject({ homeDir: input.homeDir });
  if (!project) {
    throw new Error('Expected current project to exist.');
  }
  const absolutePath = path.join(project.projectFolder, input.projectRelativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, input.contents);
}

export async function shotVideoTakeProjectFileExists(input: {
  projectData: ShotVideoTakeProjectFileService;
  homeDir: string;
  projectRelativePath: string;
}): Promise<boolean> {
  const project = await input.projectData.readCurrentProject({ homeDir: input.homeDir });
  if (!project) {
    throw new Error('Expected current project to exist.');
  }
  try {
    await fs.access(path.join(project.projectFolder, input.projectRelativePath));
    return true;
  } catch {
    return false;
  }
}

function sampleShotVideoTakeShotList(
  ids: { sceneId: string; castMemberId: string; locationId: string },
  shotCount: number
): SceneShotListDocument {
  const baseShot = {
    title: 'Map study',
    storyBeat: 'Mehmed studies the city map before the siege plan hardens.',
    narrativePurpose: 'Establish the strategic obsession driving the scene.',
    description: 'Wide static shot of Mehmed at the table with the map visible.',
    shotType: 'wide',
    cameraAngle: 'eye level',
    cameraMovement: 'static',
    framing: 'centered table composition',
    lensIntent: 'moderate wide lens feel',
    subject: 'Mehmed and the city map',
    action: 'Mehmed studies the map in silence.',
    dialogue: [],
    coveredBlockIndexes: [0],
    castMemberIds: [ids.castMemberId],
    locationIds: [ids.locationId],
    audioNotes: 'Quiet room tone and paper movement.',
    productionNotes: 'Keep warm lamplight restrained.',
  };
  return {
    kind: 'sceneShotList',
    sceneId: ids.sceneId,
    title: 'Council chamber coverage',
    summary: 'A restrained coverage plan for the first scene.',
    coverageStrategy:
      'Hold the map table and Mehmed in one composed frame to emphasize planning.',
    lookbookInfluence: 'Use the project aspect ratio unless a shot specifies otherwise.',
    shots: Array.from({ length: shotCount }, (_, index) => ({
      ...baseShot,
      shotId: `shot_${String(index + 1).padStart(3, '0')}`,
      title: index === 0 ? baseShot.title : `Map study alternate ${index + 1}`,
    })),
  };
}

function shotVideoTakeLookbookDocument() {
  return {
    kind: 'movieLookbook' as const,
    movieLookbook: {
      name: 'Imperial Wound',
      thesis: {
        statement: 'The movie should feel rigorous and tense.',
        principles: ['Use negative space as pressure.'],
      },
      palette: {
        description: 'Stone, smoke, and muted gold.',
        colors: [
          {
            hex: '#8a6f2a',
            name: 'Wounded gold',
            meaning: 'Ceremony under pressure.',
          },
        ],
        observations: [{ text: 'Warmth appears only where authority is strained.' }],
      },
      toneMood: {
        tone: 'controlled dread',
        moodTags: ['tense'],
        description: 'The image language stays austere and watchful.',
      },
      composition: {
        description: 'Orderly compositions tighten around decisions.',
        patterns: [
          {
            name: 'Map pressure',
            description: 'Maps and walls compress the frame.',
          },
        ],
      },
      lighting: {
        description: 'Practical pools of warm light cut through cool rooms.',
        patterns: [
          {
            name: 'Lamp islands',
            description: 'Oil lamps isolate decision makers.',
          },
        ],
      },
      texture: {
        description: 'Stone, vellum, smoke, and worn metal carry texture.',
        observations: [{ text: 'Fine surface texture is visible in midtones.' }],
      },
      camera: {
        description: 'Camera grammar is patient and observant.',
        movement: [
          { name: 'Slow push', description: 'Push in only when a decision hardens.' },
        ],
        motion: [
          { name: 'Held labor', description: 'Blocking moves with deliberate weight.' },
        ],
        framing: [
          { name: 'Measured distance', description: 'Close-ups are rare and earned.' },
        ],
      },
    },
    sourceInspirationFolderIds: [],
  };
}
