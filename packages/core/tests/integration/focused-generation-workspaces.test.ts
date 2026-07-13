import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { SceneShotListDocument } from '../../src/client/scene-shot-list.js';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
} from '../../src/server/index.js';
import { writeConfig } from '../../src/server/testing/project-data-fixtures.js';
import { createIsolatedSampleMovieProjectFromTemplate } from '../../src/server/testing/movie-project-template-fixtures.js';

describe('focused generation workspaces', () => {
  let homeDir: string;
  const projectName = 'constantinople';
  const projectData = createProjectDataService();

  beforeAll(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-workspace-integration-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    const project = await createIsolatedSampleMovieProjectFromTemplate({
      homeDir,
      projectData,
    });
    if (!project) throw new Error('Expected the sample movie project fixture.');
  });

  it('round-trips version-3 take design separately from the generic generation spec', async () => {
    const screenplay = await projectData.readScreenplay({ homeDir });
    const scene = screenplay.screenplay!.acts[0]!.sequences[0]!.scenes[0]!;
    const castMember = screenplay.screenplay!.cast[1]!;
    const location = screenplay.screenplay!.locations[0]!;
    const sceneId = requiredId(scene.id, 'Scene');
    const castMemberId = requiredId(castMember.id, 'Cast Member');
    const locationId = requiredId(location.id, 'Location');
    const shotList = await projectData.writeSceneShotList({
      homeDir,
      document: sampleShotList({
        sceneId,
        castMemberId,
        locationId,
      }),
      idGenerator: createDeterministicIdGenerator(),
    });
    const created = await projectData.createShotVideoTake({
      homeDir,
      projectName,
      sceneId,
      shotListId: shotList.shotList.id,
      shotIds: ['shot_001', 'shot_002'],
      title: 'Focused workspace take',
    });
    const takeId = created.overview.take.takeId;

    await projectData.setShotVideoTakeStructure({
      homeDir,
      projectName,
      sceneId,
      takeId,
      mode: 'multi-cut',
    });
    await projectData.setShotVideoTakeDirection({
      homeDir,
      projectName,
      sceneId,
      takeId,
      shotId: 'shot_001',
      direction: {
        composition: { shotSize: 'close-up', cameraAngle: 'low-angle' },
        motion: { movement: 'push-in', directions: ['forward'] },
        cast: { castMemberIds: [castMemberId] },
        location: { locationId },
      },
    });
    await projectData.setShotVideoTakePicked({
      homeDir,
      projectName,
      sceneId,
      takeId,
      picked: true,
    });

    const workspace = await projectData.readShotVideoTakeWorkspace({
      homeDir,
      projectName,
      sceneId,
      takeId,
    });
    expect(workspace.take).toMatchObject({
      takeId,
      picked: true,
      shotIds: ['shot_001', 'shot_002'],
      state: {
        version: 3,
        structure: {
          mode: 'multi-cut',
          directionsByShotId: {
            shot_001: {
              composition: { shotSize: 'close-up', cameraAngle: 'low-angle' },
              motion: { movement: 'push-in', directions: ['forward'] },
            },
          },
        },
      },
    });
    expect(workspace.generation?.spec).toBeNull();

    await expect(projectData.replaceShotVideoTakeShots({
      homeDir,
      projectName,
      sceneId,
      takeId,
      shotIds: ['shot_missing'],
    })).rejects.toMatchObject({ code: expect.any(String) });
    const unchanged = await projectData.readShotVideoTakeWorkspace({
      homeDir,
      projectName,
      sceneId,
      takeId,
    });
    expect(unchanged.take.shotIds).toEqual(['shot_001', 'shot_002']);

    const discarded = await projectData.discardShotVideoTake({
      homeDir,
      projectName,
      sceneId,
      takeId,
    });
    expect(discarded.recovery).toBeDefined();
    const active = await projectData.listShotVideoTakes({
      homeDir,
      projectName,
      sceneId,
    });
    expect(active.takes.some((take) => take.take.takeId === takeId)).toBe(false);
  });
});

function sampleShotList(input: {
  sceneId: string;
  castMemberId: string;
  locationId: string;
}): SceneShotListDocument {
  const base = {
    storyBeat: 'The map hardens into policy.',
    narrativePurpose: 'Hold the strategic decision.',
    description: 'Mehmed studies the map in lamplight.',
    shotType: 'wide',
    subject: 'Mehmed and the map',
    action: 'Mehmed studies the map.',
    dialogue: [],
    coveredBlockIndexes: [0],
    castMemberIds: [input.castMemberId],
    locationIds: [input.locationId],
  };
  return {
    kind: 'sceneShotList',
    sceneId: input.sceneId,
    title: 'Focused workspace coverage',
    summary: 'Two deterministic shots for take lifecycle verification.',
    coverageStrategy: 'Keep the map geography stable.',
    lookbookInfluence: 'Use restrained lamplight.',
    shots: [
      { ...base, shotId: 'shot_001', title: 'Map pressure' },
      { ...base, shotId: 'shot_002', title: 'Decision detail' },
    ],
  };
}

function requiredId(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(`Expected ${label} id.`);
  }
  return value;
}
