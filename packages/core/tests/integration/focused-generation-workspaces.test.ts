import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { SceneShotListDocument } from '../../src/client/scene-shot-list.js';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
} from '../../src/server/index.js';
import { writeConfig } from '../../src/server/testing/project-data-fixtures.js';
import { createIsolatedSampleMovieProjectFromTemplate } from '../../src/server/testing/movie-project-template-fixtures.js';
import { openProjectSession } from '../../src/server/database/lifecycle/active-session.js';
import {
  assetFiles,
  assets,
  mediaGenerationRuns,
  mediaGenerationSpecs,
  sceneShotReferenceAssets,
  sceneShotVideoTakeImages,
  sceneShotVideoTakes,
} from '../../src/server/schema/index.js';

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

    const projectSessionHandle = await openProjectSession({ homeDir, projectName });
    const projectFolder = projectSessionHandle.projectFolder;
    projectSessionHandle.session.close();
    const sourceImagePath = 'media/take-clone-source.png';
    const genericAudioPath = 'media/courtyard-ambience.wav';
    await fs.mkdir(path.join(projectFolder, 'media'), { recursive: true });
    await fs.writeFile(path.join(projectFolder, sourceImagePath), 'take clone fixture');
    await fs.writeFile(path.join(projectFolder, genericAudioPath), 'generic audio fixture');
    const sourceAssetId = 'asset_clone_source';
    const sourceAssetFileId = 'asset_file_clone_source';
    const genericAssetId = 'asset_generic_audio';
    const genericAssetFileId = 'asset_file_generic_audio';
    const sessionHandle = await openProjectSession({ homeDir, projectName });
    const now = new Date().toISOString();
    const sourceSpecId = 'media_generation_spec_clone_source';
    sessionHandle.session.db.transaction((tx) => {
      tx.insert(assets).values({
        id: sourceAssetId,
        type: 'image',
        mediaKind: 'image',
        title: 'Take clone source',
        origin: 'generated',
        availability: 'ready',
        createdAt: now,
        updatedAt: now,
      }).run();
      tx.insert(assetFiles).values({
        id: sourceAssetFileId,
        assetId: sourceAssetId,
        role: 'first-frame',
        projectRelativePath: sourceImagePath,
        mediaKind: 'image',
        sizeBytes: 18,
        createdAt: now,
        updatedAt: now,
      }).run();
      tx.insert(sceneShotVideoTakeImages).values({
        takeId,
        role: 'first-frame',
        assetId: sourceAssetId,
        assetFileId: sourceAssetFileId,
        createdAt: now,
        updatedAt: now,
      }).run();
      tx.insert(assets).values({
        id: genericAssetId,
        type: 'audio',
        mediaKind: 'audio',
        title: 'Courtyard ambience',
        origin: 'imported',
        availability: 'ready',
        createdAt: now,
        updatedAt: now,
      }).run();
      tx.insert(assetFiles).values({
        id: genericAssetFileId,
        assetId: genericAssetId,
        role: 'imported-media',
        projectRelativePath: genericAudioPath,
        mediaKind: 'audio',
        sizeBytes: 21,
        createdAt: now,
        updatedAt: now,
      }).run();
      tx.insert(mediaGenerationSpecs).values({
        id: sourceSpecId,
        purpose: 'shot.video-take',
        targetKind: 'sceneShotVideoTake',
        targetId: takeId,
        provider: 'test-provider',
        model: 'test-model',
        title: 'Completed source spec',
        valuesJson: JSON.stringify({ prompt: 'Opaque authored prompt' }),
        referencesJson: JSON.stringify([{
          id: 'reference_clone_source',
          placement: { kind: 'slot', sectionId: 'take-media', slotId: 'first-frame' },
          providerField: 'first_frame',
          reference: {
            kind: 'asset-file',
            assetId: sourceAssetId,
            assetFileId: sourceAssetFileId,
          },
        }]),
        createdAt: now,
        updatedAt: now,
      }).run();
      tx.insert(mediaGenerationRuns).values({
        id: 'media_generation_run_clone_source',
        specId: sourceSpecId,
        purpose: 'shot.video-take',
        targetKind: 'sceneShotVideoTake',
        targetId: takeId,
        provider: 'test-provider',
        model: 'test-model',
        specSnapshotJson: JSON.stringify({}),
        providerPayloadJson: JSON.stringify({}),
        estimateJson: JSON.stringify({}),
        approvalToken: 'approval-token',
        status: 'completed',
        outputsJson: JSON.stringify([]),
        receiptJson: JSON.stringify({}),
        diagnosticsJson: JSON.stringify([]),
        startedAt: now,
        completedAt: now,
      }).run();
    });
    sessionHandle.session.close();

    const registeredGeneric = await projectData.registerSceneShotGenericReferenceAsset({
      homeDir,
      projectName,
      sceneId,
      shotListId: shotList.shotList.id,
      shotId: 'shot_001',
      assetId: genericAssetId,
      assetFileId: genericAssetFileId,
    });
    const registeredSessionHandle = await openProjectSession({ homeDir, projectName });
    expect(registeredSessionHandle.session.db.select()
      .from(sceneShotReferenceAssets)
      .where(eq(sceneShotReferenceAssets.id, registeredGeneric.id)).get()).toMatchObject({
        sceneId,
        shotId: 'shot_001',
        assetId: genericAssetId,
        assetFileId: genericAssetFileId,
        discardedAt: null,
      });
    registeredSessionHandle.session.close();
    expect((await projectData.listGenerationReferences({
      homeDir,
      projectName,
      owner: { kind: 'sceneShot', id: 'shot_001' },
    })).items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reference: {
          kind: 'asset-file',
          assetId: genericAssetId,
          assetFileId: genericAssetFileId,
        },
      }),
    ]));

    const genericDiscard = await projectData.discardSceneShotGenericReferenceAsset({
      homeDir,
      projectName,
      relationshipId: registeredGeneric.id,
    });
    const genericDiscardedSessionHandle = await openProjectSession({ homeDir, projectName });
    expect(genericDiscardedSessionHandle.session.db.select({
      discardedAt: sceneShotReferenceAssets.discardedAt,
    }).from(sceneShotReferenceAssets)
      .where(eq(sceneShotReferenceAssets.id, registeredGeneric.id)).get()?.discardedAt)
      .not.toBeNull();
    genericDiscardedSessionHandle.session.close();
    expect((await projectData.listGenerationReferences({
      homeDir,
      projectName,
      owner: { kind: 'sceneShot', id: 'shot_001' },
    })).items).toEqual([]);
    await projectData.restoreTrashItem({
      homeDir,
      projectName,
      trashItemId: genericDiscard.recovery.restoreCommand.trashItemId,
    });
    const genericRestoredSessionHandle = await openProjectSession({ homeDir, projectName });
    expect(genericRestoredSessionHandle.session.db.select({
      discardedAt: sceneShotReferenceAssets.discardedAt,
    }).from(sceneShotReferenceAssets)
      .where(eq(sceneShotReferenceAssets.id, registeredGeneric.id)).get()?.discardedAt)
      .toBeNull();
    genericRestoredSessionHandle.session.close();
    expect((await projectData.listGenerationReferences({
      homeDir,
      projectName,
      owner: { kind: 'sceneShot', id: 'shot_001' },
    })).items).toHaveLength(1);
    await expect(projectData.registerSceneShotGenericReferenceAsset({
      homeDir,
      projectName,
      sceneId,
      shotListId: shotList.shotList.id,
      shotId: 'shot_001',
      assetId: genericAssetId,
      assetFileId: genericAssetFileId,
    })).rejects.toMatchObject({
      code: 'CORE_SCENE_SHOT_REFERENCE_ALREADY_REGISTERED',
    });

    const sharedTakeMediaReference = await projectData.registerSceneShotGenericReferenceAsset({
      homeDir,
      projectName,
      sceneId,
      shotListId: shotList.shotList.id,
      shotId: 'shot_001',
      assetId: sourceAssetId,
      assetFileId: sourceAssetFileId,
    });
    await expect(projectData.discardShotVideoTake({
      homeDir,
      projectName,
      sceneId,
      takeId,
    })).rejects.toMatchObject({ code: 'PROJECT_DATA440' });
    const conflictSessionHandle = await openProjectSession({ homeDir, projectName });
    expect(conflictSessionHandle.session.db.select({
      discardedAt: sceneShotVideoTakes.discardedAt,
    }).from(sceneShotVideoTakes).where(eq(sceneShotVideoTakes.id, takeId)).get()?.discardedAt)
      .toBeNull();
    expect(conflictSessionHandle.session.db.select({
      discardedAt: sceneShotVideoTakeImages.discardedAt,
    }).from(sceneShotVideoTakeImages).where(eq(sceneShotVideoTakeImages.takeId, takeId)).get()?.discardedAt)
      .toBeNull();
    conflictSessionHandle.session.close();
    await projectData.discardSceneShotGenericReferenceAsset({
      homeDir,
      projectName,
      relationshipId: sharedTakeMediaReference.id,
    });

    const cloned = await projectData.createSceneShotVideoTakeFromTake({
      homeDir,
      projectName,
      sceneId,
      sourceTakeId: takeId,
    });
    const clonedTakeId = cloned.overview.take.takeId;
    const cloneSessionHandle = await openProjectSession({ homeDir, projectName });
    const clonedImage = cloneSessionHandle.session.db
      .select()
      .from(sceneShotVideoTakeImages)
      .where(eq(sceneShotVideoTakeImages.takeId, clonedTakeId))
      .get();
    const clonedSpec = cloneSessionHandle.session.db
      .select()
      .from(mediaGenerationSpecs)
      .where(eq(mediaGenerationSpecs.targetId, clonedTakeId))
      .get();
    const clonedRuns = cloneSessionHandle.session.db
      .select()
      .from(mediaGenerationRuns)
      .where(eq(mediaGenerationRuns.targetId, clonedTakeId))
      .all();
    expect(cloned.overview.take).toMatchObject({ picked: false, shotIds: ['shot_001', 'shot_002'] });
    expect(clonedImage).toMatchObject({ role: 'first-frame' });
    expect(clonedImage?.assetId).not.toBe(sourceAssetId);
    expect(clonedImage?.assetFileId).not.toBe(sourceAssetFileId);
    expect(JSON.parse(clonedSpec!.referencesJson)[0].reference).toEqual({
      kind: 'asset-file',
      assetId: clonedImage!.assetId,
      assetFileId: clonedImage!.assetFileId,
    });
    expect(clonedRuns).toEqual([]);
    expect(cloneSessionHandle.session.db.select({ origin: assets.origin })
      .from(assets).where(eq(assets.id, clonedImage!.assetId)).get()).toEqual({ origin: 'copied' });
    cloneSessionHandle.session.close();

    const clonedDiscard = await projectData.discardShotVideoTake({
      homeDir,
      projectName,
      sceneId,
      takeId: clonedTakeId,
    });
    const discardedSessionHandle = await openProjectSession({ homeDir, projectName });
    expect(discardedSessionHandle.session.db.select({ discardedAt: sceneShotVideoTakeImages.discardedAt })
      .from(sceneShotVideoTakeImages).where(eq(sceneShotVideoTakeImages.takeId, clonedTakeId)).get()?.discardedAt)
      .not.toBeNull();
    discardedSessionHandle.session.close();
    expect(clonedDiscard.recovery).toBeDefined();
    await projectData.restoreTrashItem({
      homeDir,
      projectName,
      trashItemId: clonedDiscard.recovery!.restoreCommand.trashItemId,
    });
    const restoredSessionHandle = await openProjectSession({ homeDir, projectName });
    expect(restoredSessionHandle.session.db.select({ discardedAt: sceneShotVideoTakeImages.discardedAt })
      .from(sceneShotVideoTakeImages).where(eq(sceneShotVideoTakeImages.takeId, clonedTakeId)).get()?.discardedAt)
      .toBeNull();
    restoredSessionHandle.session.close();

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
