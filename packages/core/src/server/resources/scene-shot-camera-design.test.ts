import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type {
  SceneShotListDocument,
  ShotCameraDesign,
} from '../../client/scene-shot-list.js';
import { createProjectDataService } from '../index.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';

const PROJECT_NAME = 'constantinople';

describe('updateSceneShotCameraDesign', () => {
  let homeDir: string;
  let projectData = createProjectDataService();

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'renku-shot-camera-design-')
    );
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    projectData = createProjectDataService();
    await createSampleMovieProject({ projectData, homeDir });
  });

  it('persists the structured design and derives the prompt strings in place', async () => {
    const { sceneId } = await writeShotList();
    const before = await projectData.listSceneShotLists({ homeDir, sceneId });
    expect(before.shotLists).toHaveLength(1);
    const shotListId = before.activeShotListId;

    const design: ShotCameraDesign = {
      shotSize: 'medium-close-up',
      subjectFraming: ['single', 'over-the-shoulder'],
      cameraAngle: 'eye-level',
      dutch: 'left',
      movement: {
        movement: 'push-in',
        directions: ['forward'],
        track: 'straight',
        rig: 'dolly',
      },
    };

    const resource = await projectData.updateSceneShotCameraDesign({
      homeDir,
      projectName: PROJECT_NAME,
      sceneId,
      shotId: 'shot_001',
      cameraDesign: design,
    });

    const shot = resource.activeShotList?.shots.find(
      (entry) => entry.shotId === 'shot_001'
    );
    expect(shot?.cameraDesign).toEqual(design);
    // Derived contract strings stay populated for the prompt builder.
    expect(shot?.shotType).toBe('Medium Close-Up');
    expect(shot?.cameraAngle).toBe('Eye-Level, Dutch left');
    expect(shot?.framing).toBe('Single, Over Shoulder');
    expect(shot?.cameraMovement).toContain('Push In');
    expect(shot?.cameraMovement).toContain('on dolly');

    // In-place update: no new history row, same active shot list id.
    const after = await projectData.listSceneShotLists({ homeDir, sceneId });
    expect(after.shotLists).toHaveLength(1);
    expect(after.activeShotListId).toBe(shotListId);
  });

  it('clears the structured design when passed null', async () => {
    const { sceneId } = await writeShotList();
    await projectData.updateSceneShotCameraDesign({
      homeDir,
      projectName: PROJECT_NAME,
      sceneId,
      shotId: 'shot_001',
      cameraDesign: { shotSize: 'close-up' },
    });

    const cleared = await projectData.updateSceneShotCameraDesign({
      homeDir,
      projectName: PROJECT_NAME,
      sceneId,
      shotId: 'shot_001',
      cameraDesign: null,
    });

    const shot = cleared.activeShotList?.shots.find(
      (entry) => entry.shotId === 'shot_001'
    );
    expect(shot?.cameraDesign).toBeUndefined();
    expect(shot?.shotType).toBe('Unspecified');
  });

  it('clears stale prompt strings when saved camera axes are removed', async () => {
    const { sceneId } = await writeShotList();
    await projectData.updateSceneShotCameraDesign({
      homeDir,
      projectName: PROJECT_NAME,
      sceneId,
      shotId: 'shot_001',
      cameraDesign: {
        shotSize: 'close-up',
        subjectFraming: ['single'],
        cameraAngle: 'eye-level',
        movement: { movement: 'push-in' },
      },
    });

    const updated = await projectData.updateSceneShotCameraDesign({
      homeDir,
      projectName: PROJECT_NAME,
      sceneId,
      shotId: 'shot_001',
      cameraDesign: {
        movement: { movement: 'tracking' },
      },
    });

    const shot = updated.activeShotList?.shots.find(
      (entry) => entry.shotId === 'shot_001'
    );
    expect(shot?.cameraDesign).toEqual({
      movement: { movement: 'tracking' },
    });
    expect(shot?.shotType).toBe('Unspecified');
    expect(shot?.cameraAngle).toBeUndefined();
    expect(shot?.framing).toBeUndefined();
    expect(shot?.cameraMovement).toBe('Tracking');
  });

  it('preserves prompt strings for axes the structured design never owned', async () => {
    const { sceneId } = await writeShotList();

    const updated = await projectData.updateSceneShotCameraDesign({
      homeDir,
      projectName: PROJECT_NAME,
      sceneId,
      shotId: 'shot_001',
      cameraDesign: {
        movement: { movement: 'tracking' },
      },
    });

    const shot = updated.activeShotList?.shots.find(
      (entry) => entry.shotId === 'shot_001'
    );
    expect(shot?.shotType).toBe('wide');
    expect(shot?.cameraMovement).toBe('Tracking');
  });

  it('rejects an unknown vocabulary id', async () => {
    const { sceneId } = await writeShotList();
    await expect(
      projectData.updateSceneShotCameraDesign({
        homeDir,
        projectName: PROJECT_NAME,
        sceneId,
        shotId: 'shot_001',
        cameraDesign: {
          shotSize: 'not-a-real-size',
        } as unknown as ShotCameraDesign,
      })
    ).rejects.toThrow();
  });

  it('throws when the shot is not in the active shot list', async () => {
    const { sceneId } = await writeShotList();
    await expect(
      projectData.updateSceneShotCameraDesign({
        homeDir,
        projectName: PROJECT_NAME,
        sceneId,
        shotId: 'shot_999',
        cameraDesign: { shotSize: 'close-up' },
      })
    ).rejects.toThrow();
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
