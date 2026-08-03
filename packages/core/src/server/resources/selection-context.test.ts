import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SceneBeatSheetDocument } from '../../client/scene-beats/index.js';
import { createProjectDataService } from '../index.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';

const PROJECT_NAME = 'constantinople';

describe('readStudioSelectionContext', () => {
  let homeDir: string;
  let projectData = createProjectDataService();

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'renku-selection-context-')
    );
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    projectData = createProjectDataService();
    await createSampleMovieProject({ projectData, homeDir });
  });

  it('rejects Beat focus outside the Beats tab', async () => {
    const { sceneId } = await writeBeatSheet();

    await expect(
      projectData.readStudioSelectionContext({
        projectName: PROJECT_NAME,
        homeDir,
        selection: {
          type: 'scene',
          id: sceneId,
          sceneTab: 'narrative',
          beatId: 'beat_001',
        },
      })
    ).resolves.toMatchObject({
      valid: false,
      reason: 'unsupportedSelection',
      diagnostics: [{ code: 'STUDIO_COORDINATION036', severity: 'error' }],
    });
  });

  it('validates nested Shot Plan and Shot focus in Core', async () => {
    const screenplay = await projectData.readScreenplayStructure({ projectName: 'constantinople', homeDir });
    const sceneId = screenplay.screenplay.scenes[0]?.id;
    expect(sceneId).toBeTruthy();
    const firstPlan = await projectData.createShotPlan({
      projectName: PROJECT_NAME,
      homeDir,
      sceneId: sceneId!,
      title: 'First coverage',
      coverage: null,
      shots: [
        {
          title: 'Opening frame',
          description: 'Hold the council in a composed wide frame.',
          brief: {},
        },
      ],
    });
    const secondPlan = await projectData.createShotPlan({
      projectName: PROJECT_NAME,
      homeDir,
      sceneId: sceneId!,
      title: 'Second coverage',
      coverage: null,
      shots: [],
    });

    await expect(
      projectData.readStudioSelectionContext({
        projectName: PROJECT_NAME,
        homeDir,
        selection: {
          type: 'scene',
          id: sceneId!,
          sceneTab: 'shotPlans',
          shotPlanId: firstPlan.shotPlan.id,
          shotId: firstPlan.shotPlan.shots[0]!.id,
        },
      })
    ).resolves.toMatchObject({
      valid: true,
      resourceKeys: expect.arrayContaining([
        `surface:scene:${sceneId}:shot-plans`,
      ]),
    });

    await expect(
      projectData.readStudioSelectionContext({
        projectName: PROJECT_NAME,
        homeDir,
        selection: {
          type: 'scene',
          id: sceneId!,
          sceneTab: 'shotPlans',
          shotPlanId: secondPlan.shotPlan.id,
          shotId: firstPlan.shotPlan.shots[0]!.id,
        },
      })
    ).resolves.toMatchObject({
      valid: false,
      reason: 'selectionNotFound',
      diagnostics: [{ code: 'PROJECT_DATA119', severity: 'error' }],
    });
  });

  async function writeBeatSheet(): Promise<{ sceneId: string }> {
    const screenplay = await projectData.readScreenplayStructure({ projectName: 'constantinople', homeDir });
    const scene = screenplay.screenplay.scenes[0]!;
    const cast = await projectData.listCastMembers({ homeDir });
    const locations = await projectData.listLocations({ homeDir });
    const ids = {
      sceneId: scene.id,
      castMemberId: cast[1]!.id,
      locationId: locations[0]!.id,
      blockId: scene.blocks[0]!.id,
    };
    await projectData.writeSceneBeatSheet({
      homeDir,
      document: sampleBeatSheet(ids),
    });
    return { sceneId: ids.sceneId };
  }
});

function sampleBeatSheet(ids: {
  sceneId: string;
  castMemberId: string;
  locationId: string;
  blockId: string;
}): SceneBeatSheetDocument {
  return {
    sceneId: ids.sceneId,
    title: 'Council chamber coverage',
    summary: 'A restrained coverage plan for the first scene.',
    narrativeProgression: 'Hold the map table and Mehmed in one composed frame.',
    beats: [
      {
        id: 'beat_001',
        title: 'Map study',
        description:
          'Mehmed stands at the council table with the city map spread before him.',
        narrativeDevelopment: 'Mehmed studies the city map before the siege plan hardens.',
        narrativePurpose: 'Establish the strategic obsession driving the scene.',
        screenplayBlockIds: [ids.blockId],
        castMemberIds: [ids.castMemberId],
        locationIds: [ids.locationId],
        propIds: [],
      },
    ],
  };
}
