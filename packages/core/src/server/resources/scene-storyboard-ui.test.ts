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

describe('scene storyboard UI resources', () => {
  let homeDir: string;
  let projectData = createProjectDataService();

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-scene-storyboard-ui-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    projectData = createProjectDataService();
    await createSampleMovieProject({ projectData, homeDir });
  });

  it('returns activeShotList: null for a scene with no active shot list', async () => {
    const ids = await sampleIds();
    const resource = await projectData.readSceneShotListResource({
      homeDir,
      projectName: PROJECT_NAME,
      sceneId: ids.sceneId,
    });

    expect(resource.activeShotList).toBeNull();
    expect(resource.storyboardImagesByShotId).toEqual({});
  });

  it('returns images grouped by shotId from the active shot list', async () => {
    const ids = await sampleIds();
    const written = await writeShotList(ids);
    await importStoryboard(ids.sceneId, written.shotList.id, 'shot_001');

    const resource = await projectData.readSceneShotListResource({
      homeDir,
      projectName: PROJECT_NAME,
      sceneId: ids.sceneId,
    });

    expect(resource.activeShotList?.shots[0]?.shotId).toBe('shot_001');
    expect(Object.keys(resource.storyboardImagesByShotId)).toEqual(['shot_001']);
    expect(resource.castMemberLabels[ids.castMemberId]).toBeTruthy();
    expect(resource.locationLabels[ids.locationId]).toBeTruthy();
  });

  it('does not mix in images from an inactive shot list', async () => {
    const ids = await sampleIds();
    const first = await writeShotList(ids, 'First pass');
    await importStoryboard(ids.sceneId, first.shotList.id, 'shot_001');
    // A second shot list becomes the active one and has no imported storyboard.
    const second = await writeShotList(ids, 'Second pass');

    const resource = await projectData.readSceneShotListResource({
      homeDir,
      projectName: PROJECT_NAME,
      sceneId: ids.sceneId,
    });

    expect(resource.activeShotList?.title).toBe('Second pass');
    expect(resource.storyboardImagesByShotId).toEqual({});
    expect(second.shotList.id).not.toBe(first.shotList.id);
  });

  it('aggregates imported storyboard images by shot id', async () => {
    const ids = await sampleIds();
    const written = await writeShotList(ids, 'Grouped coverage', 7);
    await importStoryboard(
      ids.sceneId,
      written.shotList.id,
      'shot_001',
      'shot_002',
      'shot_003',
      'shot_004',
      'shot_005',
      'shot_006',
      'shot_007'
    );

    const resource = await projectData.readSceneShotListResource({
      homeDir,
      projectName: PROJECT_NAME,
      sceneId: ids.sceneId,
    });

    expect(Object.keys(resource.storyboardImagesByShotId).sort()).toEqual([
      'shot_001',
      'shot_002',
      'shot_003',
      'shot_004',
      'shot_005',
      'shot_006',
      'shot_007',
    ]);
  });

  it('clears sheet and view selections when changing the shot location', async () => {
    const ids = await sampleIds();
    const secondLocationId = await addSecondSceneLocation(ids.sceneId);
    await writeShotList(ids);

    await projectData.updateSceneShotLocationReference({
      homeDir,
      projectName: PROJECT_NAME,
      sceneId: ids.sceneId,
      shotId: 'shot_001',
      locationId: ids.locationId,
      environmentSheetAssetId: 'asset_original_location_sheet',
      viewIds: ['front', 'left'],
    });

    const updated = await projectData.updateSceneShotLocationReference({
      homeDir,
      projectName: PROJECT_NAME,
      sceneId: ids.sceneId,
      shotId: 'shot_001',
      locationId: secondLocationId,
    });

    const shot = updated.activeShotList?.shots.find(
      (entry) => entry.shotId === 'shot_001'
    );
    expect(shot?.shotSpecs?.location).toEqual({
      locationId: secondLocationId,
    });
  });

  it('updates views for a location that is already scoped on the active shot', async () => {
    const ids = await sampleIds();
    await removeSceneNarrativeLocation(ids.sceneId, ids.locationId);
    await writeShotList(ids);
    const assetId = await importLocationEnvironmentSheet(ids.locationId);

    const updated = await projectData.updateSceneShotLocationViewReferences({
      homeDir,
      projectName: PROJECT_NAME,
      sceneId: ids.sceneId,
      shotId: 'shot_001',
      locationId: ids.locationId,
      assetId,
      viewIds: ['front', 'right'],
    });

    const shot = updated.activeShotList?.shots.find(
      (entry) => entry.shotId === 'shot_001'
    );
    expect(shot?.shotSpecs?.location).toEqual({
      locationId: ids.locationId,
      environmentSheetAssetId: assetId,
      viewIds: ['front', 'right'],
    });
  });

  it('walks act → sequence → scene → shots and derives Shot N labels in order', async () => {
    const ids = await sampleIds();
    const written = await writeShotList(ids, 'Coverage', 2);
    await importStoryboard(ids.sceneId, written.shotList.id, 'shot_001', 'shot_002');

    const resource = await projectData.readActStoryboardResource({
      homeDir,
      projectName: PROJECT_NAME,
      actId: ids.actId,
    });

    const sceneEntry = resource.sequences
      .flatMap((sequence) => sequence.scenes)
      .find((scene) => scene.scene.id === ids.sceneId);
    expect(sceneEntry?.shots.map((shot) => shot.label)).toEqual([
      'Shot 1',
      'Shot 2',
    ]);
    expect(sceneEntry?.shots[0]?.shotId).toBe('shot_001');
  });

  it('attaches storyboard previews to sequence scenes only when images exist', async () => {
    const ids = await sampleIds();
    const before = await projectData.readSequenceResource({
      homeDir,
      projectName: PROJECT_NAME,
      sequenceId: ids.sequenceId,
    });
    expect(
      before.scenes.items.find((scene) => scene.id === ids.sceneId)?.storyboardPreview
    ).toBeUndefined();

    const written = await writeShotList(ids);
    await importStoryboard(ids.sceneId, written.shotList.id, 'shot_001');

    const after = await projectData.readSequenceResource({
      homeDir,
      projectName: PROJECT_NAME,
      sequenceId: ids.sequenceId,
    });
    expect(
      after.scenes.items.find((scene) => scene.id === ids.sceneId)?.storyboardPreview
    ).toBeTruthy();
  });

  async function writeShotList(
    ids: SampleIds,
    title = 'Council chamber coverage',
    shotCount = 1
  ) {
    return projectData.writeSceneShotList({
      homeDir,
      document: sampleShotList(ids, title, shotCount),
    });
  }

  async function importStoryboard(
    sceneId: string,
    shotListId: string,
    ...shotIds: string[]
  ) {
    const project = await projectData.readCurrentProject({ homeDir });
    const mediaFolder = path.join(project!.projectFolder, 'generated', 'media');
    await fs.mkdir(mediaFolder, { recursive: true });
    for (const shotId of shotIds) {
      await fs.writeFile(path.join(mediaFolder, `${shotId}.png`), shotId);
    }
    return projectData.importSceneStoryboardImagesMedia({
      homeDir,
      sceneId,
      shotListId,
      document: {
        kind: 'sceneStoryboardImagesImport',
        shotListId,
        shots: shotIds.map((shotId) => ({
          shotId,
          source: `generated/media/${shotId}.png`,
        })),
      },
    });
  }

  async function importLocationEnvironmentSheet(locationId: string): Promise<string> {
    const project = await projectData.readCurrentProject({ homeDir });
    const folder = 'generated/media/location-sheet-slices';
    const mediaFolder = path.join(project!.projectFolder, folder);
    await fs.mkdir(mediaFolder, { recursive: true });
    const files = {
      composite: `${folder}/composite.png`,
      view_front: `${folder}/front.png`,
      view_right: `${folder}/right.png`,
      view_back: `${folder}/back.png`,
      view_left: `${folder}/left.png`,
    };
    for (const [role, projectRelativePath] of Object.entries(files)) {
      await fs.writeFile(path.join(project!.projectFolder, projectRelativePath), role);
    }
    const imported = await projectData.importLocationEnvironmentSheetMedia({
      homeDir,
      projectName: PROJECT_NAME,
      locationId,
      files,
      title: 'Scoped location environment sheet',
    });
    return imported.imported.assetId;
  }

  async function addSecondSceneLocation(sceneId: string): Promise<string> {
    await projectData.applyLocationOperations({
      homeDir,
      document: {
        kind: 'locationOperations',
        operations: [
          {
            operation: 'location.add',
            location: {
              key: 'harbor-chain',
              handle: 'harbor-chain',
              name: 'Harbor Chain',
            },
          },
        ],
      },
    });
    const screenplay = await projectData.readScreenplay({ homeDir });
    const location = screenplay.screenplay!.locations.find(
      (candidate) => candidate.handle === 'harbor-chain'
    );
    if (!location?.id) {
      throw new Error('Expected second location to be created.');
    }
    const scene = screenplay.screenplay!.acts[0]!.sequences[0]!.scenes[0]!;
    await projectData.reviseScreenplayScene({
      homeDir,
      sceneId,
      document: {
        kind: 'screenplaySceneRevision',
        scene: {
          ...scene,
          setting: {
            ...scene.setting,
            locationIds: [
              ...(scene.setting.locationIds ?? []),
              location.id,
            ],
          },
        },
      },
    });
    return location.id;
  }

  async function removeSceneNarrativeLocation(
    sceneId: string,
    locationId: string
  ): Promise<void> {
    const screenplay = await projectData.readScreenplay({ homeDir });
    const scene = screenplay.screenplay!.acts[0]!.sequences[0]!.scenes[0]!;
    await projectData.reviseScreenplayScene({
      homeDir,
      sceneId,
      document: {
        kind: 'screenplaySceneRevision',
        scene: {
          ...scene,
          setting: {
            ...scene.setting,
            locationIds: (scene.setting.locationIds ?? []).filter(
              (candidate) => candidate !== locationId
            ),
          },
          blocks: scene.blocks.map((block) => ({
            ...block,
            locationIds: block.locationIds?.filter(
              (candidate) => candidate !== locationId
            ),
          })),
        },
      },
    });
  }

  async function sampleIds(): Promise<SampleIds> {
    const screenplay = await projectData.readScreenplay({ homeDir });
    const act = screenplay.screenplay!.acts[0]!;
    const sequence = act.sequences[0]!;
    const scene = sequence.scenes[0]!;
    return {
      actId: act.id as string,
      sequenceId: sequence.id as string,
      sceneId: scene.id as string,
      castMemberId: screenplay.screenplay!.cast[1]!.id as string,
      locationId: screenplay.screenplay!.locations[0]!.id as string,
    };
  }
});

interface SampleIds {
  actId: string;
  sequenceId: string;
  sceneId: string;
  castMemberId: string;
  locationId: string;
}

function sampleShotList(
  ids: SampleIds,
  title: string,
  shotCount: number
): SceneShotListDocument {
  const baseShot = {
    title: 'Map study',
    storyBeat: 'Mehmed studies the city map before the siege plan hardens.',
    narrativePurpose: 'Establish the strategic obsession driving the scene.',
    description: 'Wide static shot of Mehmed at the table with the map visible.',
    shotType: 'wide',
    subject: 'Mehmed and the city map',
    action: 'Mehmed studies the map in silence.',
    dialogue: [],
    coveredBlockIndexes: [0],
    castMemberIds: [ids.castMemberId],
    locationIds: [ids.locationId],
  };
  return {
    kind: 'sceneShotList',
    sceneId: ids.sceneId,
    title,
    summary: 'A restrained coverage plan for the first scene.',
    coverageStrategy: 'Hold the map table and Mehmed in one composed frame.',
    shots: Array.from({ length: shotCount }, (_, index) => ({
      ...baseShot,
      shotId: `shot_${String(index + 1).padStart(3, '0')}`,
      title: index === 0 ? baseShot.title : `Map study alternate ${index + 1}`,
    })),
  };
}
