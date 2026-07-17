import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SceneBeatSheetDocument } from '../../client/scene-beat-sheet.js';
import { createProjectDataService } from '../project-data-service.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';

describe('Scene storyboard attachment', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-storyboard-attachment-test-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
  });

  it('returns only the affected Scene Beats surface', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const screenplay = await projectData.readScreenplay({
      homeDir,
    });
    const scene = screenplay.screenplay?.acts[0]?.sequences[0]?.scenes[0];
    const castMemberId = screenplay.screenplay?.cast[0]?.id;
    const locationId = screenplay.screenplay?.locations[0]?.id;
    expect(scene?.id && castMemberId && locationId).toBeTruthy();
    const beatSheet = await projectData.writeSceneBeatSheet({
      homeDir,
      document: beatSheetDocument(scene!.id!, castMemberId!, locationId!),
    });
    await fs.mkdir(path.join(created.projectPath, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(created.projectPath, 'tmp', 'beat.png'), 'image');

    const report = await projectData.attachSceneStoryboardImages({
      projectName: 'constantinople',
      homeDir,
      sceneId: scene!.id!,
      beatSheetId: beatSheet.activeBeatSheetId,
      document: {
        kind: 'sceneStoryboardImagesImport',
        beatSheetId: beatSheet.activeBeatSheetId,
        beats: [{ beatId: 'beat_001', source: 'tmp/beat.png' }],
      },
    });
    expect(report.resourceKeys).toEqual([
      `surface:scene:${scene!.id}:beats`,
    ]);
  });
});

function beatSheetDocument(
  sceneId: string,
  castMemberId: string,
  locationId: string
): SceneBeatSheetDocument {
  return {
    kind: 'sceneBeatSheet',
    sceneId,
    title: 'Storyboard coverage',
    summary: 'One Beat for attachment verification.',
    narrativeProgression: 'Hold on the decisive image.',
    beats: [
      {
        id: 'beat_001',
        title: 'Decision',
        description: 'The decision lands in a held frame.',
        narrativeDevelopment: 'The scene reaches its visual decision.',
        narrativePurpose: 'Establish the decisive moment.',
        screenplayBlockIndexes: [0],
        castMemberIds: [castMemberId],
        locationIds: [locationId],
      },
    ],
  };
}
