import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SceneBeatSheetDocument } from '../../client/scene-beats/index.js';
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

  it('persists ordinary Beat candidates and changes selection only when requested', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const screenplay = await projectData.readScreenplayStructure({
      projectName: 'constantinople',
      homeDir,
    });
    const scene = screenplay.screenplay.scenes[0];
    const sceneReferences = screenplay.screenplay.references.filter((reference) =>
      scene && 'sceneId' in reference.target && reference.target.sceneId === scene.id
    );
    const castMemberId = sceneReferences.find(
      (reference) => reference.subject.type === 'castMember'
    )?.subject.id;
    const locationId = sceneReferences.find(
      (reference) => reference.subject.type === 'location'
    )?.subject.id;
    expect(scene?.id && castMemberId && locationId).toBeTruthy();
    const beatSheet = await projectData.writeSceneBeatSheet({
      homeDir,
      document: beatSheetDocument(scene!.id, scene!.blocks[0]!.id, castMemberId!, locationId!),
    });
    await fs.mkdir(path.join(created.projectPath, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(created.projectPath, 'tmp', 'beat.png'), 'image');

    const report = await projectData.attachSceneStoryboardImages({
      homeDir,
      sceneId: scene!.id!,
      beatSheetId: beatSheet.activeBeatSheetId,
      document: {
        beatSheetId: beatSheet.activeBeatSheetId,
        select: true,
        beats: [{ beatId: 'beat_001', source: 'tmp/beat.png' }],
      },
    });
    expect(report.resourceKeys).toEqual([
      `surface:scene:${scene!.id}:beats`,
    ]);
    expect(report.imported).toHaveLength(1);

    const initiallySelected = await projectData.readSceneBeatSheetStoryboardStatus({
      homeDir,
      sceneId: scene!.id!,
      beatSheetId: beatSheet.activeBeatSheetId,
    });
    expect(initiallySelected.beats[0]).toMatchObject({
      beatId: 'beat_001',
      selectedImageId: report.imported[0]!.id,
      images: [expect.objectContaining({
        id: report.imported[0]!.id,
        owner: {
          kind: 'sceneBeat',
          sceneId: scene!.id!,
          beatId: 'beat_001',
        },
      })],
    });

    await fs.writeFile(
      path.join(created.projectPath, 'tmp', 'beat-candidate.png'),
      'second image'
    );
    const unselected = await projectData.attachSceneStoryboardImages({
      projectName: 'constantinople',
      homeDir,
      sceneId: scene!.id!,
      beatSheetId: beatSheet.activeBeatSheetId,
      document: {
        beatSheetId: beatSheet.activeBeatSheetId,
        select: false,
        beats: [{
          beatId: 'beat_001',
          source: 'tmp/beat-candidate.png',
        }],
      },
    });
    const afterUnselectedImport =
      await projectData.readSceneBeatSheetStoryboardStatus({
        homeDir,
        sceneId: scene!.id!,
        beatSheetId: beatSheet.activeBeatSheetId,
      });
    expect(afterUnselectedImport.beats[0]!.images).toHaveLength(2);
    expect(afterUnselectedImport.beats[0]!.selectedImageId).toBe(
      report.imported[0]!.id
    );

    await projectData.selectAsset({
      projectName: 'constantinople',
      homeDir,
      target: {
        kind: 'sceneBeat',
        sceneId: scene!.id!,
        beatId: 'beat_001',
      },
      assetId: unselected.imported[0]!.id,
    });
    const afterExplicitSelection =
      await projectData.readSceneBeatSheetStoryboardStatus({
        homeDir,
        sceneId: scene!.id!,
        beatSheetId: beatSheet.activeBeatSheetId,
      });
    expect(afterExplicitSelection.beats[0]!.selectedImageId).toBe(
      unselected.imported[0]!.id
    );
  });
});

function beatSheetDocument(
  sceneId: string,
  blockId: string,
  castMemberId: string,
  locationId: string
): SceneBeatSheetDocument {
  return {
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
        screenplayBlockIds: [blockId],
        castMemberIds: [castMemberId],
        locationIds: [locationId],
        propIds: [],
      },
    ],
  };
}
