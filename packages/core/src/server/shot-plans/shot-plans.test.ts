import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { createProjectDataService } from '../project-data-service.js';
import { assets } from '../schema/index.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';

describe('Shot Plans', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-shot-plans-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
  });

  it('keeps authoring, copying, and lifecycle independent from soft generation context', async () => {
    const projectData = createProjectDataService();
    const fixture = await createProjectFixture(projectData, homeDir);
    if (!fixture) {
      return;
    }
    const plan = await createPlan(projectData, homeDir, fixture.sceneId);
    const spec = await projectData.createGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      spec: {
        purpose: 'image.create',
        target: { kind: 'project', id: 'project' },
        authoredFrom: { kind: 'shotPlan', id: plan.shotPlan.id },
        executionKind: 'agent-external',
        values: { prompt: 'Opaque authored request.' },
        references: [],
      },
    });
    const copied = await projectData.copyShotPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
    });

    expect(copied.shotPlan.id).not.toBe(plan.shotPlan.id);
    expect(copied.shotPlan.shots).toHaveLength(1);
    expect(copied.shotPlan.shots[0]!.id).not.toBe(plan.shotPlan.shots[0]!.id);
    expect((await projectData.listGenerationSpecs({
      projectName: 'constantinople',
      homeDir,
      authoredFrom: { kind: 'shotPlan', id: plan.shotPlan.id },
    })).map((record) => record.id)).toEqual([spec.id]);
    expect((await projectData.listGenerationSpecs({
      projectName: 'constantinople',
      homeDir,
      authoredFrom: { kind: 'shotPlan', id: copied.shotPlan.id },
    }))).toEqual([]);

    const deleted = await projectData.deleteShotPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
    });
    await expect(projectData.readGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      specId: spec.id,
    })).resolves.toMatchObject({
      id: spec.id,
      spec: {
        authoredFrom: { kind: 'shotPlan', id: plan.shotPlan.id },
      },
    });
    await projectData.restoreTrashItem({
      projectName: 'constantinople',
      homeDir,
      trashItemId: deleted.recovery.trashItemIds[0]!,
    });
    await expect(projectData.readShotPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
    })).resolves.toMatchObject({
      shotPlan: {
        id: plan.shotPlan.id,
        shots: [expect.objectContaining({ id: plan.shotPlan.shots[0]!.id })],
      },
    });

    await projectData.deleteShotPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
    });
    const preview = await projectData.previewGarbageCollection({
      projectName: 'constantinople',
      homeDir,
      olderThanIso: '9999-12-31T23:59:59.999Z',
    });
    await projectData.emptyTrash({
      projectName: 'constantinople',
      homeDir,
      olderThanIso: '9999-12-31T23:59:59.999Z',
      confirmationToken: preview.confirmationToken,
    });
    await expect(projectData.readShotPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
    })).rejects.toMatchObject({ code: 'CORE_SHOT_PLAN_NOT_FOUND' });
    await expect(projectData.readGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      specId: spec.id,
    })).resolves.toMatchObject({
      id: spec.id,
      spec: {
        authoredFrom: { kind: 'shotPlan', id: plan.shotPlan.id },
      },
    });
  });

  it('keeps mutable Shot Plan authoring behavior unchanged', async () => {
    const projectData = createProjectDataService();
    const fixture = await createProjectFixture(projectData, homeDir);
    if (!fixture) {
      return;
    }
    const created = await projectData.createShotPlan({
      projectName: 'constantinople',
      homeDir,
      sceneId: fixture.sceneId,
      title: '  First pass  ',
      coverage: {
        beatSheetId: 'scene_beat_sheet_missing',
        beatIds: [],
      },
      shots: [],
    });
    expect(created.shotPlan.title).toBe('First pass');
    expect(created.warnings).toEqual([
      expect.objectContaining({
        code: 'CORE_SHOT_PLAN_BEAT_SHEET_MISSING',
      }),
    ]);
    const updated = await projectData.updateShotPlanDetails({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: created.shotPlan.id,
      title: 'Second pass',
      coverage: null,
    });
    expect(updated.shotPlan.title).toBe('Second pass');
    const authored = await projectData.addShotToPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: created.shotPlan.id,
      shot: {
        title: 'Establishing drift',
        description: '**Wide** establishing frame.',
        brief: {
          durationSeconds: 2.5,
          motion: { movement: 'slow lateral drift' },
        },
      },
    });
    expect(authored.shotPlan.shots).toEqual([
      expect.objectContaining({
        position: 0,
        title: 'Establishing drift',
      }),
    ]);
  });

  it('owns image candidates, explicit selection, selected-only copy, and recoverable cleanup', async () => {
    const projectData = createProjectDataService();
    const fixture = await createProjectFixture(projectData, homeDir);
    if (!fixture) {
      return;
    }
    await expect(
      projectData.buildGenerationContext({
        projectName: 'constantinople',
        homeDir,
        purpose: 'shot.image',
        target: { kind: 'shot', id: 'shot_missing' },
      })
    ).rejects.toMatchObject({ code: 'CORE_SHOT_NOT_FOUND' });
    const plan = await createPlan(projectData, homeDir, fixture.sceneId);
    const shot = plan.shotPlan.shots[0]!;
    const context = await projectData.buildGenerationContext({
      projectName: 'constantinople',
      homeDir,
      purpose: 'shot.image',
      target: { kind: 'shot', id: shot.id },
    });
    expect(context).toMatchObject({
      purpose: 'shot.image',
      target: { kind: 'shot', id: shot.id },
      outputMediaKind: 'image',
      facts: {
        shotPlanId: plan.shotPlan.id,
        shotId: shot.id,
        shotTitle: shot.title,
        projectAspectRatio: '16:9',
      },
      settings: {
        recommended: expect.arrayContaining([
          { kind: 'aspect-ratio', value: '16:9' },
        ]),
      },
    });
    const sourceSpec = await projectData.createGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      spec: {
        purpose: 'shot.image',
        target: { kind: 'shot', id: shot.id },
        executionKind: 'agent-external',
        model: { provider: 'codex', model: 'gpt-image-2' },
        values: { prompt: 'Opaque authored Shot image prompt.' },
        references: [],
      },
    });
    await projectData.freezeGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      specId: sourceSpec.id,
    });
    await fs.mkdir(path.join(fixture.projectFolder, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(fixture.projectFolder, 'tmp', 'shot.png'), 'image');

    const first = await projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'shot.image',
      target: { kind: 'shot', id: shot.id },
      sourceProjectRelativePath: 'tmp/shot.png',
      title: 'First candidate',
      sourceSpecId: sourceSpec.id,
    });
    const second = await projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'shot.image',
      target: { kind: 'shot', id: shot.id },
      sourceProjectRelativePath: 'tmp/shot.png',
      title: 'Second candidate',
      sourceSpecId: sourceSpec.id,
    });
    const initialShot = (
      await projectData.readShotPlan({
        projectName: 'constantinople',
        homeDir,
        shotPlanId: plan.shotPlan.id,
      })
    ).shotPlan.shots[0]!;
    expect(initialShot.selectedImageId).toBeNull();
    expect(initialShot.images.map((image) => image.id)).toEqual(
      expect.arrayContaining([first.asset.id, second.asset.id])
    );
    await expect(
      projectData.selectAsset({
        projectName: 'constantinople',
        homeDir,
        target: { kind: 'shot', id: shot.id },
        assetId: 'asset_missing',
      })
    ).rejects.toMatchObject({ code: 'CORE_ASSET_SELECTION_INVALID' });

    const selected = await projectData.selectAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'shot', id: shot.id },
      assetId: first.asset.id,
    });
    expect(selected.resourceKeys).toEqual([
      `surface:scene:${fixture.sceneId}:shot-plans`,
    ]);
    const discarded = await projectData.discardShotImageCandidate({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
      shotId: shot.id,
      assetId: first.asset.id,
    });
    expect(
      (
        await projectData.readShotPlan({
          projectName: 'constantinople',
          homeDir,
          shotPlanId: plan.shotPlan.id,
        })
      ).shotPlan.shots[0]!.selectedImageId
    ).toBeNull();
    const restoredCandidate = await projectData.restoreTrashItem({
      projectName: 'constantinople',
      homeDir,
      trashItemId: discarded.recovery.trashItemIds[0]!,
    });
    expect(restoredCandidate.resourceKeys).toEqual([
      `surface:scene:${fixture.sceneId}:shot-plans`,
    ]);
    await projectData.selectAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'shot', id: shot.id },
      assetId: first.asset.id,
    });

    const copied = await projectData.copyShotPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
    });
    const copiedShot = copied.shotPlan.shots[0]!;
    expect(copiedShot.images).toHaveLength(1);
    expect(copiedShot.selectedImageId).toBe(copiedShot.images[0]!.id);
    expect(copiedShot.selectedImageId).not.toBe(first.asset.id);
    expect(copiedShot.images[0]!.owner).toEqual({
      kind: 'shot',
      id: copiedShot.id,
    });
    expect(copiedShot.images[0]!.files[0]!.projectRelativePath).not.toBe(
      first.asset.files[0]!.projectRelativePath
    );
    await expect(
      fs.readFile(
        path.join(
          fixture.projectFolder,
          copiedShot.images[0]!.files[0]!.projectRelativePath
        )
      )
    ).resolves.toEqual(
      await fs.readFile(
        path.join(
          fixture.projectFolder,
          first.asset.files[0]!.projectRelativePath
        )
      )
    );
    await expect(
      projectData.listAssets({
        projectName: 'constantinople',
        homeDir,
        owner: { kind: 'shot', id: copiedShot.id },
      })
    ).resolves.toEqual([
      expect.objectContaining({ id: copiedShot.selectedImageId }),
    ]);

    const originalDeletion = await projectData.deleteShotPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
    });
    const sharedOwnerSession = await openProjectSession({
      projectName: 'constantinople',
      homeDir,
    });
    try {
      const [assetState] = sharedOwnerSession.session.db
        .all(sql`
          select discarded_at, restored_at
          from asset
          where id = ${first.asset.id}
        `) as Array<{
          discarded_at: string | null;
          restored_at: string | null;
        }>;
      expect(assetState?.discarded_at).not.toBeNull();
      expect(
        sharedOwnerSession.session.db
          .select()
          .from(assets)
          .where(eq(assets.id, copiedShot.selectedImageId!))
          .get()?.discardedAt
      ).toBeNull();
    } finally {
      sharedOwnerSession.session.close();
    }
    await projectData.restoreTrashItem({
      projectName: 'constantinople',
      homeDir,
      trashItemId: originalDeletion.recovery.trashItemIds[0]!,
    });
    expect(
      (
        await projectData.readShotPlan({
          projectName: 'constantinople',
          homeDir,
          shotPlanId: plan.shotPlan.id,
        })
      ).shotPlan.shots[0]!.selectedImageId
    ).toBe(first.asset.id);

    await projectData.clearAssetSelection({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'shot', id: shot.id },
    });
    const removed = await projectData.removeShotFromPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
      shotId: shot.id,
    });
    expect(
      (
        await projectData.readShotPlan({
          projectName: 'constantinople',
          homeDir,
          shotPlanId: plan.shotPlan.id,
        })
      ).shotPlan.shots
    ).toEqual([]);
    await projectData.restoreTrashItem({
      projectName: 'constantinople',
      homeDir,
      trashItemId: removed.recovery.trashItemIds[0]!,
    });
    expect(
      (
        await projectData.readShotPlan({
          projectName: 'constantinople',
          homeDir,
          shotPlanId: plan.shotPlan.id,
        })
      ).shotPlan.shots[0]!.selectedImageId
    ).toBeNull();

    const copyDeletion = await projectData.deleteShotPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: copied.shotPlan.id,
    });
    expect(
      (
        await projectData.readShotPlan({
          projectName: 'constantinople',
          homeDir,
          shotPlanId: plan.shotPlan.id,
        })
      ).shotPlan.shots[0]!.images.map((image) => image.id)
    ).toEqual(expect.arrayContaining([first.asset.id, second.asset.id]));
    await projectData.restoreTrashItem({
      projectName: 'constantinople',
      homeDir,
      trashItemId: copyDeletion.recovery.trashItemIds[0]!,
    });
    await expect(
      projectData.listAssets({
        projectName: 'constantinople',
        homeDir,
        owner: { kind: 'shot', id: copiedShot.id },
      })
    ).resolves.toEqual([
      expect.objectContaining({ id: copiedShot.selectedImageId }),
    ]);

    const genericDiscard = await projectData.discardAsset({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'shot', id: shot.id },
      assetId: second.asset.id,
    });
    expect(genericDiscard.resourceKeys).toEqual([
      `surface:scene:${fixture.sceneId}:shot-plans`,
    ]);
    await projectData.restoreTrashItem({
      projectName: 'constantinople',
      homeDir,
      trashItemId: genericDiscard.recovery.trashItemIds[0]!,
    });
  });

  it('keeps an older selected image in a Shot Plan with more than one asset page', async () => {
    const projectData = createProjectDataService();
    const fixture = await createProjectFixture(projectData, homeDir);
    if (!fixture) {
      return;
    }
    const plan = await createPlan(projectData, homeDir, fixture.sceneId);
    const shot = plan.shotPlan.shots[0]!;
    const sourceSpec = await projectData.createGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      spec: {
        purpose: 'shot.image',
        target: { kind: 'shot', id: shot.id },
        executionKind: 'agent-external',
        model: { provider: 'codex', model: 'gpt-image-2' },
        values: { prompt: 'Opaque authored Shot image prompt.' },
        references: [],
      },
    });
    await projectData.freezeGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      specId: sourceSpec.id,
    });
    await fs.mkdir(path.join(fixture.projectFolder, 'tmp'), { recursive: true });
    await fs.writeFile(
      path.join(fixture.projectFolder, 'tmp', 'shot.png'),
      'image'
    );
    const selected = await projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'shot.image',
      target: { kind: 'shot', id: shot.id },
      sourceProjectRelativePath: 'tmp/shot.png',
      title: 'Old selected candidate',
      sourceSpecId: sourceSpec.id,
    });
    await projectData.selectAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'shot', id: shot.id },
      assetId: selected.asset.id,
    });
    for (let index = 0; index < 60; index += 1) {
      await projectData.attachGenerationMedia({
        projectName: 'constantinople',
        homeDir,
        purpose: 'shot.image',
        target: { kind: 'shot', id: shot.id },
        sourceProjectRelativePath: 'tmp/shot.png',
        title: `New candidate ${index + 1}`,
        sourceSpecId: sourceSpec.id,
      });
    }
    const { session } = await openProjectSession({
      projectName: 'constantinople',
      homeDir,
    });
    try {
      session.db
        .update(assets)
        .set({ createdAt: '2000-01-01T00:00:00.000Z' })
        .where(eq(assets.id, selected.asset.id))
        .run();
    } finally {
      session.close();
    }

    const projectedShot = (
      await projectData.readShotPlan({
        projectName: 'constantinople',
        homeDir,
        shotPlanId: plan.shotPlan.id,
      })
    ).shotPlan.shots[0]!;
    expect(projectedShot.images).toHaveLength(61);
    expect(projectedShot.selectedImageId).toBe(selected.asset.id);
    expect(projectedShot.images).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: selected.asset.id }),
      ])
    );
  });

});

async function createProjectFixture(
  projectData: ReturnType<typeof createProjectDataService>,
  homeDir: string
): Promise<{
  sceneId: string;
  projectFolder: string;
} | null> {
  const created = await createSampleMovieProject({ projectData, homeDir });
  if (!created) {
    return null;
  }
  const screenplay = await projectData.readScreenplay({ homeDir });
  const sceneId =
    screenplay.screenplay?.acts[0]?.sequences[0]?.scenes[0]?.id;
  if (!sceneId) {
    throw new Error('Expected the sample project Scene.');
  }
  return {
    sceneId,
    projectFolder: created.projectPath,
  };
}

async function createPlan(
  projectData: ReturnType<typeof createProjectDataService>,
  homeDir: string,
  sceneId: string
) {
  return projectData.createShotPlan({
    projectName: 'constantinople',
    homeDir,
    sceneId,
    title: 'Plan',
    coverage: null,
    shots: [{ title: 'One shot', description: 'One shot.', brief: {} }],
  });
}
