import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SceneShotListDocument } from '../../client/scene-shot-list.js';
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

  it('rejects narrative scene selections that include shot-level state', async () => {
    const { sceneId } = await writeShotList();

    await expect(
      projectData.readStudioSelectionContext({
        projectName: PROJECT_NAME,
        homeDir,
        selection: {
          type: 'scene',
          id: sceneId,
          sceneTab: 'narrative',
          shotId: 'shot_001',
        },
      })
    ).resolves.toMatchObject({
      valid: false,
      reason: 'unsupportedSelection',
      diagnostics: [{ code: 'STUDIO_COORDINATION036', severity: 'error' }],
    });

    await expect(
      projectData.readStudioSelectionContext({
        projectName: PROJECT_NAME,
        homeDir,
        selection: {
          type: 'scene',
          id: sceneId,
          sceneTab: 'narrative',
          shotTab: 'composition',
        },
      })
    ).resolves.toMatchObject({
      valid: false,
      reason: 'unsupportedSelection',
      diagnostics: [{ code: 'STUDIO_COORDINATION036', severity: 'error' }],
    });
  });

  async function writeShotList(): Promise<{ sceneId: string }> {
    const screenplay = await projectData.readScreenplay({ homeDir });
    const act = screenplay.screenplay!.acts[0]!;
    const sequence = act.sequences[0]!;
    const scene = sequence.scenes[0]!;
    const ids = {
      sceneId: scene.id as string,
      castMemberId: screenplay.screenplay!.cast[1]!.id as string,
      locationId: screenplay.screenplay!.locations[0]!.id as string,
    };
    await projectData.writeSceneShotList({
      homeDir,
      document: sampleShotList(ids),
    });
    return { sceneId: ids.sceneId };
  }
});

function sampleShotList(ids: {
  sceneId: string;
  castMemberId: string;
  locationId: string;
}): SceneShotListDocument {
  return {
    kind: 'sceneShotList',
    sceneId: ids.sceneId,
    title: 'Council chamber coverage',
    summary: 'A restrained coverage plan for the first scene.',
    coverageStrategy: 'Hold the map table and Mehmed in one composed frame.',
    shots: [
      {
        shotId: 'shot_001',
        title: 'Map study',
        storyBeat: 'Mehmed studies the city map before the siege plan hardens.',
        narrativePurpose: 'Establish the strategic obsession driving the scene.',
        description: 'Wide static shot of Mehmed at the table with the map.',
        shotType: 'wide',
        subject: 'Mehmed and the city map',
        action: 'Mehmed studies the map in silence.',
        dialogue: [],
        coveredBlockIndexes: [0],
        castMemberIds: [ids.castMemberId],
        locationIds: [ids.locationId],
      },
    ],
  };
}
