import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SceneBeatSheetDocument } from '../../client/scene-beat-sheet.js';
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

  async function writeBeatSheet(): Promise<{ sceneId: string }> {
    const screenplay = await projectData.readScreenplay({ homeDir });
    const act = screenplay.screenplay!.acts[0]!;
    const sequence = act.sequences[0]!;
    const scene = sequence.scenes[0]!;
    const ids = {
      sceneId: scene.id as string,
      castMemberId: screenplay.screenplay!.cast[1]!.id as string,
      locationId: screenplay.screenplay!.locations[0]!.id as string,
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
}): SceneBeatSheetDocument {
  return {
    kind: 'sceneBeatSheet',
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
        screenplayBlockIndexes: [0],
        castMemberIds: [ids.castMemberId],
        locationIds: [ids.locationId],
      },
    ],
  };
}
