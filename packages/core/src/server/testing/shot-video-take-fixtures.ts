import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type {
  SceneShotListDocument,
  SceneShotVideoTake,
} from '../../client/index.js';
import { createDeterministicIdGenerator, createProjectDataService } from '../index.js';
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

export async function createShotVideoTakeTestProject(): Promise<ShotVideoTakeTestProject> {
  const homeDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'renku-shot-video-take-test-')
  );
  await writeConfig(homeDir, path.join(homeDir, 'projects'));
  const projectData = createProjectDataService();
  await createSampleMovieProject({ projectData, homeDir });

  return {
    homeDir,
    projectData,
    async sampleIds() {
      const screenplay = await projectData.readScreenplay({ homeDir });
      const scene = screenplay.screenplay!.acts[0]!.sequences[0]!.scenes[0]!;
      return {
        sceneId: scene.id as string,
        castMemberId: screenplay.screenplay!.cast[1]!.id as string,
        narratorCastMemberId: screenplay.screenplay!.cast[0]!.id as string,
        locationId: screenplay.screenplay!.locations[0]!.id as string,
      };
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
      const take = await projectData.createSceneShotVideoTake({
        homeDir,
        sceneId: ids.sceneId,
        shotListId: report.shotList.id,
        shotIds: document.shots.map((shot) => shot.shotId),
        idGenerator: createDeterministicIdGenerator(),
      });
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
