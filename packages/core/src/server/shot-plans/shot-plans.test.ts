import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { insertGenerationRunRecord } from '../database/access/media-generation.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { freezeManagedGenerationSpec } from '../generation/spec-lifecycle.js';
import { createProjectDataService } from '../project-data-service.js';
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

  it('keeps mutable authoring and one reusable last Generation Spec', async () => {
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
    expect(created.shotPlan.lastGenerationSpec).toBeNull();
    expect(created.warnings).toEqual([
      expect.objectContaining({
        code: 'CORE_SHOT_PLAN_BEAT_SHEET_MISSING',
      }),
    ]);
    await expect(
      projectData.createNextShotPlanGenerationSpec({
        projectName: 'constantinople',
        homeDir,
        shotPlanId: created.shotPlan.id,
      })
    ).rejects.toMatchObject({
      code: 'CORE_SHOT_PLAN_GENERATION_SPEC_MISSING',
    });
    const copiedWithoutSpec = await projectData.copyShotPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: created.shotPlan.id,
    });
    expect(copiedWithoutSpec.shotPlan.lastGenerationSpec).toBeNull();

    await projectData.updateShotPlanDetails({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: created.shotPlan.id,
      title: 'Second pass',
      coverage: null,
    });
    await projectData.addShotToPlan({
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
    const authored = await projectData.addShotToPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: created.shotPlan.id,
      shot: {
        title: 'Close detail',
        description: 'Close detail.',
        brief: { optics: { focalLengthMm: 50 } },
      },
    });
    expect(authored.shotPlan.shots.map((shot) => shot.position)).toEqual([0, 1]);

    const sourceSpec = await createVideoSpec(projectData, {
      homeDir,
      shotPlanId: created.shotPlan.id,
      executionKind: 'agent-external',
      title: 'Video request',
    });
    await projectData.setShotPlanLastGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: created.shotPlan.id,
      lastGenerationSpecId: sourceSpec.id,
    });
    await projectData.freezeGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      specId: sourceSpec.id,
    });
    const copiedFromFrozen = await projectData.copyShotPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: created.shotPlan.id,
    });
    expect(copiedFromFrozen.shotPlan.lastGenerationSpec).toMatchObject({
      frozenAt: null,
      spec: {
        authoredFrom: {
          kind: 'shotPlan',
          id: copiedFromFrozen.shotPlan.id,
        },
      },
    });

    const next = await projectData.createNextShotPlanGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: created.shotPlan.id,
    });
    expect(next.shotPlan.lastGenerationSpec).toMatchObject({
      frozenAt: null,
      spec: sourceSpec.spec,
    });
    expect(next.shotPlan.lastGenerationSpec?.id).not.toBe(sourceSpec.id);
    expect((await projectData.readGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      specId: sourceSpec.id,
    })).frozenAt).not.toBeNull();

    await expect(
      projectData.createNextShotPlanGenerationSpec({
        projectName: 'constantinople',
        homeDir,
        shotPlanId: created.shotPlan.id,
      })
    ).rejects.toMatchObject({
      code: 'CORE_SHOT_PLAN_GENERATION_SPEC_MUTABLE',
    });

    const copied = await projectData.copyShotPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: created.shotPlan.id,
    });
    expect(copied.shotPlan.id).not.toBe(created.shotPlan.id);
    expect(copied.shotPlan.shots.map((shot) => shot.id)).not.toEqual(
      authored.shotPlan.shots.map((shot) => shot.id)
    );
    expect(copied.shotPlan.lastGenerationSpec).toMatchObject({
      frozenAt: null,
      spec: {
        purpose: 'video.create',
        target: { kind: 'project', id: 'project' },
        authoredFrom: { kind: 'shotPlan', id: copied.shotPlan.id },
        executionKind: 'agent-external',
        title: 'Video request',
      },
    });
    expect(copied.shotPlan.lastGenerationSpec?.id).not.toBe(
      next.shotPlan.lastGenerationSpec?.id
    );

    const editedAgain = await projectData.updateShotPlanDetails({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: created.shotPlan.id,
      title: 'Still editable',
      coverage: null,
    });
    expect(editedAgain.shotPlan.title).toBe('Still editable');
    expect(editedAgain.shotPlan.lastGenerationSpec?.id).toBe(
      next.shotPlan.lastGenerationSpec?.id
    );
  });

  it('associates only a video request authored from the same Shot Plan', async () => {
    const projectData = createProjectDataService();
    const fixture = await createProjectFixture(projectData, homeDir);
    if (!fixture) {
      return;
    }
    const plan = await createPlan(projectData, homeDir, fixture.sceneId);
    const otherPlan = await createPlan(projectData, homeDir, fixture.sceneId);
    const wrongPurpose = await projectData.createGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      spec: {
        purpose: 'image.create',
        target: { kind: 'project', id: 'project' },
        executionKind: 'agent-external',
        values: {},
        references: [],
      },
    });
    const wrongPlan = await createVideoSpec(projectData, {
      homeDir,
      shotPlanId: otherPlan.shotPlan.id,
      executionKind: 'agent-external',
    });

    for (const lastGenerationSpecId of [wrongPurpose.id, wrongPlan.id]) {
      await expect(
        projectData.setShotPlanLastGenerationSpec({
          projectName: 'constantinople',
          homeDir,
          shotPlanId: plan.shotPlan.id,
          lastGenerationSpecId,
        })
      ).rejects.toMatchObject({
        code: 'CORE_SHOT_PLAN_GENERATION_SPEC_INVALID',
      });
    }
  });

  it('retains the last frozen Spec across failed and successful Runs', async () => {
    const projectData = createProjectDataService();
    const fixture = await createProjectFixture(projectData, homeDir);
    if (!fixture) {
      return;
    }
    const plan = await createPlan(projectData, homeDir, fixture.sceneId);
    const spec = await createVideoSpec(projectData, {
      homeDir,
      shotPlanId: plan.shotPlan.id,
      executionKind: 'agent-external',
    });
    await projectData.setShotPlanLastGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
      lastGenerationSpecId: spec.id,
    });
    const frozen = await projectData.freezeGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      specId: spec.id,
    });

    const { session } = await openProjectSession({
      projectName: 'constantinople',
      homeDir,
    });
    try {
      insertGenerationRunRecord(
        session,
        generationRun({
          id: 'media_generation_run_failed',
          specId: frozen.id,
          spec: frozen.spec,
          status: 'failed',
          outputs: [],
        })
      );
      insertGenerationRunRecord(
        session,
        generationRun({
          id: 'media_generation_run_completed',
          specId: frozen.id,
          spec: frozen.spec,
          status: 'completed',
          outputs: [{
            artifactId: 'artifact-video',
            projectRelativePath: 'tmp/completed.mp4' as never,
          }],
        })
      );
    } finally {
      session.close();
    }

    const afterRuns = await projectData.readShotPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
    });
    expect(afterRuns.shotPlan.lastGenerationSpec?.id).toBe(spec.id);
    expect(afterRuns.shotPlan.lastGenerationSpec?.frozenAt).not.toBeNull();

    const next = await projectData.createNextShotPlanGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
    });
    expect(next.shotPlan.lastGenerationSpec).toMatchObject({
      frozenAt: null,
      spec: frozen.spec,
    });
  });

  it('imports provenance-backed videos as independent Project Assets', async () => {
    const projectData = createProjectDataService();
    const fixture = await createProjectFixture(projectData, homeDir);
    if (!fixture) {
      return;
    }
    const plan = await createPlan(projectData, homeDir, fixture.sceneId);
    const lastSpec = await createVideoSpec(projectData, {
      homeDir,
      shotPlanId: plan.shotPlan.id,
      executionKind: 'agent-external',
      title: 'First try',
    });
    const otherSpec = await createVideoSpec(projectData, {
      homeDir,
      shotPlanId: plan.shotPlan.id,
      executionKind: 'agent-external',
      title: 'Another try',
    });
    const managedSpec = await createVideoSpec(projectData, {
      homeDir,
      shotPlanId: plan.shotPlan.id,
      executionKind: 'renku-managed',
      title: 'Managed try',
    });
    await projectData.setShotPlanLastGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
      lastGenerationSpecId: lastSpec.id,
    });
    await projectData.freezeGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      specId: lastSpec.id,
    });
    await projectData.freezeGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      specId: otherSpec.id,
    });
    await fs.mkdir(path.join(fixture.projectFolder, 'tmp'), { recursive: true });
    await fs.writeFile(
      path.join(fixture.projectFolder, 'tmp', 'external.mp4'),
      'video'
    );
    await fs.writeFile(
      path.join(fixture.projectFolder, 'tmp', 'managed.mp4'),
      'video'
    );
    const { session } = await openProjectSession({
      projectName: 'constantinople',
      homeDir,
    });
    try {
      freezeManagedGenerationSpec({
        record: managedSpec,
        session,
        now: '2026-07-24T10:00:00.000Z',
      });
      insertGenerationRunRecord(
        session,
        generationRun({
          id: 'media_generation_run_video_import',
          specId: managedSpec.id,
          spec: managedSpec.spec,
          status: 'completed',
          outputs: [{
            artifactId: 'artifact-managed-video',
            projectRelativePath: 'tmp/managed.mp4' as never,
            mimeType: 'video/mp4',
            contentHash: createHash('sha256').update('video').digest('hex'),
          }],
        })
      );
    } finally {
      session.close();
    }

    await expect(projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'video.create',
      target: { kind: 'project', id: 'project' },
      sourceProjectRelativePath: 'tmp/external.mp4',
    })).rejects.toMatchObject({
      code: 'CORE_GENERATION_ATTACHMENT_PROVENANCE_REQUIRED',
    });

    const first = await projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'video.create',
      target: { kind: 'project', id: 'project' },
      sourceProjectRelativePath: 'tmp/external.mp4',
      title: 'First try',
      sourceSpecId: lastSpec.id,
    });
    const second = await projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'video.create',
      target: { kind: 'project', id: 'project' },
      sourceProjectRelativePath: 'tmp/external.mp4',
      title: 'First try',
      sourceSpecId: otherSpec.id,
    });
    const managed = await projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'video.create',
      target: { kind: 'project', id: 'project' },
      sourceProjectRelativePath: 'tmp/managed.mp4',
      title: 'Managed try',
      receipt: { id: 'media_generation_run_video_import' },
    });
    expect(first.asset).toMatchObject({
      role: 'generated-video',
      mediaKind: 'video',
      files: [
        expect.objectContaining({
          role: 'primary',
          projectRelativePath: 'videos/first-try.mp4',
        }),
      ],
    });
    expect(second.asset).toMatchObject({
      files: [
        expect.objectContaining({
          projectRelativePath: 'videos/first-try-2.mp4',
        }),
      ],
    });
    expect(first.provenance).toEqual({ generationSpecId: lastSpec.id });
    expect(second.provenance).toEqual({ generationSpecId: otherSpec.id });
    expect(managed.provenance).toEqual({
      generationRunId: 'media_generation_run_video_import',
    });

    await projectData.updateShotInPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
      shotId: plan.shotPlan.shots[0]!.id,
      shot: {
        title: 'Changed shot',
        description: 'Changed shot.',
        brief: {},
      },
    });
    const afterAttachments = await projectData.updateShotPlanDetails({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
      title: 'Editable after videos',
      coverage: null,
    });
    expect(afterAttachments.shotPlan.lastGenerationSpec?.id).toBe(lastSpec.id);

    const discarded = await projectData.discardAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'project' },
      assetId: first.asset.assetId,
    });
    expect((await projectData.readShotPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
    })).shotPlan.lastGenerationSpec?.id).toBe(lastSpec.id);
    await projectData.restoreTrashItem({
      projectName: 'constantinople',
      homeDir,
      trashItemId: discarded.recovery.trashItemIds[0]!,
    });
    expect((await projectData.readShotPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
    })).shotPlan.lastGenerationSpec?.id).toBe(lastSpec.id);
  });

  it('deletes and restores a Shot Plan without changing independent media', async () => {
    const projectData = createProjectDataService();
    const fixture = await createProjectFixture(projectData, homeDir);
    if (!fixture) {
      return;
    }
    const plan = await createPlan(projectData, homeDir, fixture.sceneId);
    const spec = await createVideoSpec(projectData, {
      homeDir,
      shotPlanId: plan.shotPlan.id,
      executionKind: 'agent-external',
    });
    await projectData.setShotPlanLastGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
      lastGenerationSpecId: spec.id,
    });
    await projectData.freezeGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      specId: spec.id,
    });
    await fs.mkdir(path.join(fixture.projectFolder, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(fixture.projectFolder, 'tmp', 'final.mp4'), 'video');
    const attachment = await projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'video.create',
      target: { kind: 'project', id: 'project' },
      sourceProjectRelativePath: 'tmp/final.mp4',
      sourceSpecId: spec.id,
    });

    const deleted = await projectData.deleteShotPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
    });
    await expect(projectData.readShotPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
    })).rejects.toMatchObject({ code: 'CORE_SHOT_PLAN_NOT_FOUND' });

    const { session } = await openProjectSession({
      projectName: 'constantinople',
      homeDir,
    });
    try {
      const [state] = session.db.all(sql`
        select
          (select count(*) from shot where shot_plan_id = ${plan.shotPlan.id}) as shot_count,
          (select discarded_at from asset where id = ${attachment.asset.assetId}) as asset_discarded_at,
          (select count(*) from media_generation_spec where id = ${spec.id}) as spec_count,
          (select count(*) from project_asset where asset_id = ${attachment.asset.assetId}) as relationship_count
      `) as Array<{
        shot_count: number;
        asset_discarded_at: string | null;
        spec_count: number;
        relationship_count: number;
      }>;
      expect(state).toEqual({
        shot_count: 1,
        asset_discarded_at: null,
        spec_count: 1,
        relationship_count: 1,
      });
    } finally {
      session.close();
    }

    await projectData.restoreTrashItem({
      projectName: 'constantinople',
      homeDir,
      trashItemId: deleted.recovery.trashItemIds[0]!,
    });
    const restored = await projectData.readShotPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
    });
    expect(restored.shotPlan.lastGenerationSpec?.id).toBe(spec.id);
    expect(restored.shotPlan.shots).toHaveLength(1);
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
    if (!('files' in first.asset) || !('files' in second.asset)) {
      throw new Error('Expected shot.image attachments to return complete Assets.');
    }
    expect(
      (
        await projectData.readShotPlan({
          projectName: 'constantinople',
          homeDir,
          shotPlanId: plan.shotPlan.id,
        })
      ).shotPlan.shots[0]!.representativeImage
    ).toBeNull();
    await expect(
      projectData.setShotRepresentativeImage({
        projectName: 'constantinople',
        homeDir,
        shotPlanId: plan.shotPlan.id,
        shotId: shot.id,
        assetId: 'asset_missing',
      })
    ).rejects.toMatchObject({ code: 'CORE_SHOT_IMAGE_INVALID' });

    const selected = await projectData.setShotRepresentativeImage({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
      shotId: shot.id,
      assetId: first.asset.assetId,
    });
    expect(selected.shotPlan.shots[0]!.representativeImage).toMatchObject({
      assetId: first.asset.assetId,
      role: 'shot-image',
    });
    await expect(
      projectData.discardShotImageCandidate({
        projectName: 'constantinople',
        homeDir,
        shotPlanId: plan.shotPlan.id,
        shotId: shot.id,
        assetId: first.asset.assetId,
      })
    ).rejects.toMatchObject({
      code: 'CORE_SHOT_IMAGE_DISCARD_SELECTED',
    });

    const discarded = await projectData.discardShotImageCandidate({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
      shotId: shot.id,
      assetId: second.asset.assetId,
    });
    const restoredCandidate = await projectData.restoreTrashItem({
      projectName: 'constantinople',
      homeDir,
      trashItemId: discarded.recovery.trashItemIds[0]!,
    });
    expect(restoredCandidate.resourceKeys).toEqual([
      `surface:scene:${fixture.sceneId}:shot-plans`,
    ]);
    expect(
      (
        await projectData.readShotPlan({
          projectName: 'constantinople',
          homeDir,
          shotPlanId: plan.shotPlan.id,
        })
      ).shotPlan.shots[0]!.representativeImage?.assetId
    ).toBe(first.asset.assetId);

    const copied = await projectData.copyShotPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
    });
    const copiedShot = copied.shotPlan.shots[0]!;
    expect(copiedShot.representativeImage?.assetId).toBe(first.asset.assetId);
    expect(
      await projectData.listAssets({
        projectName: 'constantinople',
        homeDir,
        target: { kind: 'shot', shotId: copiedShot.id },
      })
    ).toHaveLength(1);

    const sharedOwnerDeletion = await projectData.deleteShotPlan({
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
          where id = ${first.asset.assetId}
        `) as Array<{
          discarded_at: string | null;
          restored_at: string | null;
        }>;
      expect(assetState).toEqual({
        discarded_at: null,
        restored_at: null,
      });
    } finally {
      sharedOwnerSession.session.close();
    }
    await projectData.restoreTrashItem({
      projectName: 'constantinople',
      homeDir,
      trashItemId: sharedOwnerDeletion.recovery.trashItemIds[0]!,
    });
    const restoredSharedOwnerSession = await openProjectSession({
      projectName: 'constantinople',
      homeDir,
    });
    try {
      const [assetState] = restoredSharedOwnerSession.session.db
        .all(sql`
          select discarded_at, restored_at
          from asset
          where id = ${first.asset.assetId}
        `) as Array<{
          discarded_at: string | null;
          restored_at: string | null;
        }>;
      expect(assetState).toEqual({
        discarded_at: null,
        restored_at: null,
      });
    } finally {
      restoredSharedOwnerSession.session.close();
    }

    await projectData.clearShotRepresentativeImage({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
      shotId: shot.id,
    });
    const sharedCandidateDiscard = await projectData.discardShotImageCandidate({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
      shotId: shot.id,
      assetId: first.asset.assetId,
    });
    const sharedCopyDeletion = await projectData.deleteShotPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: copied.shotPlan.id,
    });
    await projectData.restoreTrashItem({
      projectName: 'constantinople',
      homeDir,
      trashItemId: sharedCandidateDiscard.recovery.trashItemIds[0]!,
    });
    expect(
      (
        await projectData.readShotPlan({
          projectName: 'constantinople',
          homeDir,
          shotPlanId: plan.shotPlan.id,
        })
      ).shotPlan.shots[0]!.representativeImage
    ).toBeNull();
    expect(
      await projectData.listAssets({
        projectName: 'constantinople',
        homeDir,
        target: { kind: 'shot', shotId: shot.id },
      })
    ).toHaveLength(2);
    await projectData.restoreTrashItem({
      projectName: 'constantinople',
      homeDir,
      trashItemId: sharedCopyDeletion.recovery.trashItemIds[0]!,
    });
    await projectData.setShotRepresentativeImage({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
      shotId: shot.id,
      assetId: first.asset.assetId,
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
      ).shotPlan.shots[0]!.representativeImage?.assetId
    ).toBe(first.asset.assetId);

    const deletedOriginal = await projectData.deleteShotPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
    });
    expect(
      (
        await projectData.readShotPlan({
          projectName: 'constantinople',
          homeDir,
          shotPlanId: copied.shotPlan.id,
        })
      ).shotPlan.shots[0]!.representativeImage?.assetId
    ).toBe(first.asset.assetId);

    const deletedCopy = await projectData.deleteShotPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: copied.shotPlan.id,
    });
    const garbageCollection = await projectData.previewGarbageCollection({
      projectName: 'constantinople',
      homeDir,
    });
    const collectablePaths = garbageCollection.files.map(
      (file) => file.originalProjectRelativePath
    );
    expect(collectablePaths).toHaveLength(2);
    expect(new Set(collectablePaths).size).toBe(2);
    expect(collectablePaths).toEqual(
      expect.arrayContaining([
        first.asset.files[0]!.projectRelativePath,
        second.asset.files[0]!.projectRelativePath,
      ])
    );

    const restoredOriginal = await projectData.restoreTrashItem({
      projectName: 'constantinople',
      homeDir,
      trashItemId: deletedOriginal.recovery.trashItemIds[0]!,
    });
    expect(restoredOriginal.resourceKeys).toEqual([
      `surface:scene:${fixture.sceneId}:shot-plans`,
    ]);
    expect(
      await projectData.listAssets({
        projectName: 'constantinople',
        homeDir,
        target: { kind: 'shot', shotId: shot.id },
      })
    ).toHaveLength(2);

    await projectData.restoreTrashItem({
      projectName: 'constantinople',
      homeDir,
      trashItemId: deletedCopy.recovery.trashItemIds[0]!,
    });
    expect(
      await projectData.listAssets({
        projectName: 'constantinople',
        homeDir,
        target: { kind: 'shot', shotId: copiedShot.id },
      })
    ).toHaveLength(1);
  });

  it('keeps video.create context project-scoped and free of Shot Plan facts', async () => {
    const projectData = createProjectDataService();
    const fixture = await createProjectFixture(projectData, homeDir);
    if (!fixture) {
      return;
    }
    const context = await projectData.buildGenerationContext({
      projectName: 'constantinople',
      homeDir,
      purpose: 'video.create',
      target: { kind: 'project', id: 'project' },
    });

    expect(context.outputMediaKind).toBe('video');
    expect(context.facts).toEqual({ projectAspectRatio: '16:9' });
    expect(context.referenceGuide.sections).toEqual([]);
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

async function createVideoSpec(
  projectData: ReturnType<typeof createProjectDataService>,
  input: {
    homeDir: string;
    shotPlanId: string;
    executionKind: 'renku-managed' | 'agent-external';
    title?: string;
  }
) {
  return projectData.createGenerationSpec({
    projectName: 'constantinople',
    homeDir: input.homeDir,
    spec: {
      purpose: 'video.create',
      target: { kind: 'project', id: 'project' },
      authoredFrom: { kind: 'shotPlan', id: input.shotPlanId },
      executionKind: input.executionKind,
      ...(input.title ? { title: input.title } : {}),
      model: { provider: 'agent', model: 'opaque-video' },
      values: { prompt: 'Exact authored request.', duration: 5 },
      references: [],
    },
  });
}

function generationRun(input: {
  id: string;
  specId: string;
  spec: Awaited<ReturnType<typeof createVideoSpec>>['spec'];
  status: 'failed' | 'completed';
  outputs: Array<{
    artifactId: string;
    projectRelativePath?: import('../../client/project.js').ProjectRelativePath;
    mimeType?: string;
    contentHash?: string;
  }>;
}) {
  return {
    id: input.id,
    specId: input.specId,
    specSnapshot: input.spec,
    provider: 'fixture',
    model: 'video',
    providerPayload: {},
    estimate: {
      provider: 'fixture',
      model: 'video',
      estimatedCostUsd: 0,
      approvalToken: 'fixture',
      billableUnits: {},
    },
    status: input.status,
    outputs: input.outputs,
    receipt: null,
    diagnostics: [],
    startedAt: '2026-07-24T10:00:00.000Z',
    completedAt: '2026-07-24T10:01:00.000Z',
  };
}
