import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { BeatInput, SceneBeatsInput } from '../../client/scene-beats/index.js';
import { createDeterministicIdGenerator, createProjectDataService } from '../index.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';

describe('Scene Beats revision commands', () => {
  let homeDir: string;
  let projectData = createProjectDataService();

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-scene-beats-test-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    projectData = createProjectDataService();
    await createSampleMovieProject({ projectData, homeDir });
  });

  it('returns Scene-specific context', async () => {
    const ids = await sampleIds();
    const context = await projectData.readSceneBeatsContext({
      homeDir,
      sceneId: ids.sceneId,
    });

    expect(context.valid).toBe(true);
    expect(context.project.aspectRatio).toBe('16:9');
    expect(context.scene.title).toBe('A Throne Facing an Ancient City');
    expect(context.cast).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: ids.castMemberId })])
    );
    expect(context.locations).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: ids.locationId })])
    );
    expect(context.activeRevision).toBeNull();
  });

  it('validates input while treating unavailable creative references as warnings', async () => {
    const ids = await sampleIds();
    const document = sampleSceneBeats(ids);

    await expect(projectData.validateSceneBeats({ homeDir, document })).resolves.toMatchObject({
      valid: true,
      warnings: [],
    });
    await expect(projectData.validateSceneBeats({
      homeDir,
      document: {
        ...document,
        beats: [{ ...document.beats[0]!, screenplayBlockIds: ['block_missing'] }],
      },
    })).resolves.toMatchObject({
      valid: true,
      warnings: [expect.objectContaining({ code: 'SCENE_BEATS_SCREENPLAY_BLOCK_MISSING' })],
    });
  });

  it('creates, resets, lists, reads, and changes active revisions without deleting history', async () => {
    const ids = await sampleIds();
    const first = await projectData.createSceneBeatsRevision({
      homeDir,
      document: sampleSceneBeats(ids),
      idGenerator: createDeterministicIdGenerator(),
    });
    const firstRead = await projectData.readSceneBeatsRevision({
      homeDir,
      revisionId: first.revision.id,
    });
    expect(firstRead.sceneBeats?.beats).toEqual([
      expect.objectContaining({ id: 'beat_test0001', number: '1' }),
    ]);

    const reset = await projectData.resetSceneBeats({
      homeDir,
      document: { ...sampleSceneBeats(ids), beats: [sampleBeat(ids), sampleBeat(ids, 'Commitment')] },
      idGenerator: createDeterministicIdGenerator(),
    });
    expect(reset.revision.baseRevisionId).toBe(first.revision.id);

    const secondReset = await projectData.resetSceneBeats({
      homeDir,
      document: {
        ...sampleSceneBeats(ids),
        beats: [
          sampleBeat(ids),
          sampleBeat(ids, 'Commitment'),
          sampleBeat(ids, 'Consequence'),
        ],
      },
      idGenerator: createDeterministicIdGenerator(),
    });
    expect(secondReset.revision.baseRevisionId).toBe(reset.revision.id);

    const revisions = await projectData.listSceneBeatsRevisions({ homeDir, sceneId: ids.sceneId });
    expect(revisions.revisions).toHaveLength(3);
    expect(revisions.activeRevisionId).toBe(secondReset.revision.id);

    await projectData.setActiveSceneBeatsRevision({
      homeDir,
      sceneId: ids.sceneId,
      revisionId: first.revision.id,
    });
    await expect(projectData.readSceneBeatsRevision({
      homeDir,
      active: true,
      sceneId: ids.sceneId,
    })).resolves.toMatchObject({
      revision: { id: first.revision.id },
      sceneBeats: { beats: [expect.objectContaining({ number: '1' })] },
    });

    await projectData.setActiveSceneBeatsRevision({
      homeDir,
      sceneId: ids.sceneId,
      revisionId: secondReset.revision.id,
    });
    await expect(projectData.listSceneBeatsRevisions({
      homeDir,
      sceneId: ids.sceneId,
    })).resolves.toMatchObject({
      activeRevisionId: secondReset.revision.id,
      revisions: expect.arrayContaining([
        expect.objectContaining({ id: first.revision.id }),
        expect.objectContaining({ id: reset.revision.id }),
        expect.objectContaining({ id: secondReset.revision.id }),
      ]),
    });
  });

  it('creates immutable focused revisions and never reuses a deleted Beat number', async () => {
    const ids = await sampleIds();
    const initial = await projectData.createSceneBeatsRevision({
      homeDir,
      document: { ...sampleSceneBeats(ids), beats: [sampleBeat(ids), sampleBeat(ids, 'Commitment')] },
      idGenerator: createDeterministicIdGenerator(),
    });
    const initialRead = await projectData.readSceneBeatsRevision({ homeDir, revisionId: initial.revision.id });
    const firstBeatId = initialRead.sceneBeats!.beats[0]!.id;

    const deletion = await projectData.applySceneBeatsOperations({
      homeDir,
      document: {
        sceneId: ids.sceneId,
        baseRevisionId: initial.revision.id,
        activate: true,
        operations: [{ operation: 'beats.delete', beatIds: [firstBeatId] }],
      },
      idGenerator: createDeterministicIdGenerator(),
    });
    const insertion = await projectData.applySceneBeatsOperations({
      homeDir,
      document: {
        sceneId: ids.sceneId,
        baseRevisionId: deletion.createdRevisionId,
        activate: true,
        operations: [{ operation: 'beats.insert', placement: { position: 'start' }, beats: [sampleBeat(ids, 'Return')] }],
      },
      idGenerator: createDeterministicIdGenerator(),
    });
    const inserted = await projectData.readSceneBeatsRevision({ homeDir, revisionId: insertion.createdRevisionId });
    expect(inserted.sceneBeats!.beats.map((beat) => beat.number)).toEqual(['2A', '2']);
    await expect(projectData.readSceneBeatsRevision({
      homeDir,
      revisionId: initial.revision.id,
    })).resolves.toMatchObject({
      sceneBeats: { beats: [expect.objectContaining({ number: '1' }), expect.objectContaining({ number: '2' })] },
    });
  });

  it('rejects filesystem paths in references added by focused operations', async () => {
    const ids = await sampleIds();
    const initial = await projectData.createSceneBeatsRevision({
      homeDir,
      document: sampleSceneBeats(ids),
      idGenerator: createDeterministicIdGenerator(),
    });
    const initialRead = await projectData.readSceneBeatsRevision({
      homeDir,
      revisionId: initial.revision.id,
    });
    const beatId = initialRead.sceneBeats!.beats[0]!.id;

    await expect(projectData.applySceneBeatsOperations({
      homeDir,
      document: {
        sceneId: ids.sceneId,
        baseRevisionId: initial.revision.id,
        activate: true,
        operations: [{
          operation: 'beats.insert',
          placement: { position: 'end' },
          beats: [{ ...sampleBeat(ids), castMemberIds: ['/Users/example/cast.png'] }],
        }],
      },
      idGenerator: createDeterministicIdGenerator(),
    })).rejects.toMatchObject({ code: 'SCENE_BEATS_INVALID' });

    await expect(projectData.applySceneBeatsOperations({
      homeDir,
      document: {
        sceneId: ids.sceneId,
        baseRevisionId: initial.revision.id,
        activate: true,
        operations: [{
          operation: 'beat.update',
          beatId,
          beat: { ...sampleBeat(ids), propIds: ['C:\\Users\\example\\prop.png'] },
        }],
      },
      idGenerator: createDeterministicIdGenerator(),
    })).rejects.toMatchObject({ code: 'SCENE_BEATS_INVALID' });
  });

  async function sampleIds() {
    const screenplay = await projectData.readScreenplayStructure({ projectName: 'constantinople', homeDir });
    const scene = screenplay.screenplay.scenes[0]!;
    const cast = await projectData.listCastMembers({ homeDir });
    const locations = await projectData.listLocations({ homeDir });
    return {
      sceneId: scene.id,
      castMemberId: cast[1]!.id,
      locationId: locations[0]!.id,
      blockId: scene.blocks[0]!.id,
    };
  }
});

type SampleIds = {
  sceneId: string;
  castMemberId: string;
  locationId: string;
  blockId: string;
};

function sampleSceneBeats(ids: SampleIds): SceneBeatsInput {
  return { sceneId: ids.sceneId, beats: [sampleBeat(ids)] };
}

function sampleBeat(ids: SampleIds, title = 'Map study'): BeatInput {
  return {
    title,
    description: 'Mehmed stands at the council table with the city map spread before him.',
    narrativeDevelopment: 'The siege plan hardens.',
    narrativePurpose: 'Establish the strategic obsession driving the Scene.',
    screenplayBlockIds: [ids.blockId],
    castMemberIds: [ids.castMemberId],
    locationIds: [ids.locationId],
    propIds: [],
  };
}
