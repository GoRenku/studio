import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProjectDataService } from '../project-data-service.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { insertGenerationRunRecord } from '../database/access/media-generation.js';

describe('Shot Plans', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-shot-plans-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
  });

  it('directly authors ordered Shots, validates briefs, and copies the current Spec', async () => {
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
    expect(created.shotPlan.shots).toEqual([]);
    expect(created.warnings).toEqual([
      expect.objectContaining({
        code: 'CORE_SHOT_PLAN_BEAT_SHEET_MISSING',
      }),
    ]);

    const withShots = await projectData.updateShotPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: created.shotPlan.id,
      title: 'First pass',
      coverage: null,
      shots: [
        {
          description: '**Wide** establishing frame.',
          brief: {
            durationSeconds: 2.5,
            camera: { movement: 'slow lateral drift' },
          },
        },
        {
          description: '',
          brief: {
            optics: {
              focalLengthMm: 50,
              depthOfField: 'shallow',
            },
          },
        },
      ],
    });
    const [firstShot, secondShot] = withShots.shotPlan.shots;
    expect(withShots.shotPlan.shots.map((shot) => shot.position)).toEqual([0, 1]);
    expect(firstShot?.description).toBe('**Wide** establishing frame.');

    const reordered = await projectData.updateShotPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: created.shotPlan.id,
      title: 'Second pass',
      coverage: null,
      shots: [
        {
          id: secondShot!.id,
          description: 'Close detail.',
          brief: { lighting: { key: 'window light' } },
        },
        {
          description: 'New ending.',
          brief: {},
        },
      ],
    });
    expect(reordered.shotPlan.shots).toMatchObject([
      { id: secondShot!.id, position: 0, description: 'Close detail.' },
      { position: 1, description: 'New ending.' },
    ]);
    expect(reordered.shotPlan.shots.some((shot) => shot.id === firstShot!.id)).toBe(
      false
    );

    await expect(
      projectData.updateShotPlan({
        projectName: 'constantinople',
        homeDir,
        shotPlanId: created.shotPlan.id,
        title: 'Invalid brief',
        coverage: null,
        shots: [
          {
            id: secondShot!.id,
            description: 'Invalid.',
            brief: {
              durationSeconds: 0,
              camera: { movement: 'track', invented: 'field' },
            } as never,
          },
        ],
      })
    ).rejects.toMatchObject({ code: 'CORE_SHOT_PLAN_INVALID' });

    const sourceSpec = await projectData.createGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      spec: {
        purpose: 'shot-plan.video',
        target: { kind: 'shotPlan', id: created.shotPlan.id },
        executionKind: 'agent-external',
        title: 'Video request',
        model: { provider: 'agent', model: 'opaque-video' },
        values: { prompt: 'Exact authored request.', duration: 5 },
        references: [
          {
            placement: { kind: 'additional' },
            promptMention: '@Image1',
            reference: {
              kind: 'project-file',
              projectRelativePath: 'references/exact-frame.png' as never,
            },
          },
        ],
      },
    });
    await projectData.setShotPlanGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: created.shotPlan.id,
      generationSpecId: sourceSpec.id,
    });
    await projectData.freezeGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      specId: sourceSpec.id,
    });

    const copied = await projectData.copyShotPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: created.shotPlan.id,
    });
    expect(copied.shotPlan.id).not.toBe(created.shotPlan.id);
    expect(copied.shotPlan.shots.map((shot) => shot.id)).not.toEqual(
      reordered.shotPlan.shots.map((shot) => shot.id)
    );
    expect(copied.shotPlan.videoAssetId).toBeNull();
    expect(copied.shotPlan.generationSpec).toMatchObject({
      frozenAt: null,
      spec: {
        purpose: 'shot-plan.video',
        target: { kind: 'shotPlan', id: copied.shotPlan.id },
        executionKind: 'agent-external',
        title: 'Video request',
        model: { provider: 'agent', model: 'opaque-video' },
        values: { prompt: 'Exact authored request.', duration: 5 },
        references: sourceSpec.spec.references,
      },
    });
    expect(copied.shotPlan.generationSpec?.id).not.toBe(sourceSpec.id);
  });

  it('attaches manual and managed videos atomically and freezes only on attachment', async () => {
    const projectData = createProjectDataService();
    const fixture = await createProjectFixture(projectData, homeDir);
    if (!fixture) {
      return;
    }
    const plan = await createPlan(projectData, homeDir, fixture.sceneId);
    await fs.mkdir(path.join(fixture.projectFolder, 'tmp'), { recursive: true });
    await fs.writeFile(
      path.join(fixture.projectFolder, 'tmp', 'manual.bin'),
      Buffer.from([0, 1, 2, 3])
    );

    const manual = await projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'shot-plan.video',
      target: { kind: 'shotPlan', id: plan.shotPlan.id },
      sourceProjectRelativePath: 'tmp/manual.bin',
    });
    expect(manual.asset).toMatchObject({
      assetId: expect.any(String),
      assetFileId: expect.any(String),
      projectRelativePath: expect.stringMatching(
        /^shots\/.+\/.+\/shot_plan_.+\/video\.bin$/
      ),
    });
    expect(
      (await projectData.readShotPlan({
        projectName: 'constantinople',
        homeDir,
        shotPlanId: plan.shotPlan.id,
      })).shotPlan.videoAssetId
    ).toBe(manual.asset.assetId);

    await expect(
      projectData.updateShotPlan({
        projectName: 'constantinople',
        homeDir,
        shotPlanId: plan.shotPlan.id,
        title: 'Too late',
        coverage: null,
        shots: [],
      })
    ).rejects.toMatchObject({ code: 'CORE_SHOT_PLAN_FROZEN' });
    await expect(
      projectData.attachGenerationMedia({
        projectName: 'constantinople',
        homeDir,
        purpose: 'shot-plan.video',
        target: { kind: 'shotPlan', id: plan.shotPlan.id },
        sourceProjectRelativePath: 'tmp/manual.bin',
      })
    ).rejects.toMatchObject({ code: 'CORE_SHOT_PLAN_VIDEO_EXISTS' });

    const managedPlan = await createPlan(
      projectData,
      homeDir,
      fixture.sceneId,
      'Managed'
    );
    const spec = await projectData.createGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      spec: {
        purpose: 'shot-plan.video',
        target: { kind: 'shotPlan', id: managedPlan.shotPlan.id },
        executionKind: 'renku-managed',
        model: { provider: 'fixture', model: 'video' },
        values: { prompt: 'Opaque prompt.' },
        references: [],
      },
    });
    await projectData.setShotPlanGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: managedPlan.shotPlan.id,
      generationSpecId: spec.id,
    });
    await fs.writeFile(
      path.join(fixture.projectFolder, 'tmp', 'managed-one.mp4'),
      'one'
    );
    await fs.writeFile(
      path.join(fixture.projectFolder, 'tmp', 'managed-two.mp4'),
      'two'
    );
    const { session } = await openProjectSession({
      projectName: 'constantinople',
      homeDir,
    });
    try {
      insertGenerationRunRecord(session, {
        id: 'media_generation_run_shot_plan',
        specId: spec.id,
        specSnapshot: spec.spec,
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
        status: 'failed',
        outputs: [
          {
            artifactId: 'one',
            projectRelativePath: 'tmp/managed-one.mp4' as never,
          },
          {
            artifactId: 'two',
            projectRelativePath: 'tmp/managed-two.mp4' as never,
          },
        ],
        receipt: null,
        diagnostics: [],
        startedAt: '2026-07-23T10:00:00.000Z',
        completedAt: '2026-07-23T10:01:00.000Z',
      });
    } finally {
      session.close();
    }
    const managed = await projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'shot-plan.video',
      target: { kind: 'shotPlan', id: managedPlan.shotPlan.id },
      sourceProjectRelativePath: 'tmp/managed-two.mp4',
      receipt: { id: 'media_generation_run_shot_plan' },
    });
    expect(managed.provenance).toEqual({
      generationRunId: 'media_generation_run_shot_plan',
    });
  });

  it('deletes and restores the plan and its video without trashing generation history', async () => {
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
        purpose: 'shot-plan.video',
        target: { kind: 'shotPlan', id: plan.shotPlan.id },
        executionKind: 'agent-external',
        values: { prompt: 'Preserved history.' },
        references: [],
      },
    });
    await projectData.setShotPlanGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
      generationSpecId: spec.id,
    });
    await fs.mkdir(path.join(fixture.projectFolder, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(fixture.projectFolder, 'tmp', 'final.mp4'), 'video');
    const attachment = await projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'shot-plan.video',
      target: { kind: 'shotPlan', id: plan.shotPlan.id },
      sourceProjectRelativePath: 'tmp/final.mp4',
    });

    const deleted = await projectData.deleteShotPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
    });
    await expect(
      projectData.readShotPlan({
        projectName: 'constantinople',
        homeDir,
        shotPlanId: plan.shotPlan.id,
      })
    ).rejects.toMatchObject({ code: 'CORE_SHOT_PLAN_NOT_FOUND' });

    const { session } = await openProjectSession({
      projectName: 'constantinople',
      homeDir,
    });
    try {
      const rows = session.db.all(sql`
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
      expect(rows[0]).toMatchObject({
        shot_count: 1,
        asset_discarded_at: expect.any(String),
        spec_count: 1,
        relationship_count: 0,
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
    expect(restored.shotPlan.videoAssetId).toBe(attachment.asset.assetId);
    expect(restored.shotPlan.generationSpec?.id).toBe(spec.id);
    expect(restored.shotPlan.shots).toHaveLength(1);
  });

  it('requires an external video attachment to use the current frozen Spec', async () => {
    const projectData = createProjectDataService();
    const fixture = await createProjectFixture(projectData, homeDir);
    if (!fixture) {
      return;
    }
    const plan = await createPlan(projectData, homeDir, fixture.sceneId);
    const currentSpec = await projectData.createGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      spec: {
        purpose: 'shot-plan.video',
        target: { kind: 'shotPlan', id: plan.shotPlan.id },
        executionKind: 'agent-external',
        values: { prompt: 'Current request.' },
        references: [],
      },
    });
    const otherSpec = await projectData.createGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      spec: {
        purpose: 'shot-plan.video',
        target: { kind: 'shotPlan', id: plan.shotPlan.id },
        executionKind: 'agent-external',
        values: { prompt: 'Not current.' },
        references: [],
      },
    });
    await projectData.setShotPlanGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
      generationSpecId: currentSpec.id,
    });
    await projectData.freezeGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      specId: currentSpec.id,
    });
    await projectData.freezeGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      specId: otherSpec.id,
    });
    await fs.mkdir(path.join(fixture.projectFolder, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(fixture.projectFolder, 'tmp', 'external.mp4'), 'video');

    await expect(
      projectData.attachGenerationMedia({
        projectName: 'constantinople',
        homeDir,
        purpose: 'shot-plan.video',
        target: { kind: 'shotPlan', id: plan.shotPlan.id },
        sourceProjectRelativePath: 'tmp/external.mp4',
        sourceSpecId: otherSpec.id,
      })
    ).rejects.toMatchObject({
      code: 'CORE_SHOT_PLAN_GENERATION_SPEC_INVALID',
    });
    const attachment = await projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'shot-plan.video',
      target: { kind: 'shotPlan', id: plan.shotPlan.id },
      sourceProjectRelativePath: 'tmp/external.mp4',
      sourceSpecId: currentSpec.id,
    });
    expect(attachment.provenance).toEqual({
      generationSpecId: currentSpec.id,
    });
  });

  it('builds video reference facts without Beat or Shot creative content', async () => {
    const projectData = createProjectDataService();
    const fixture = await createProjectFixture(projectData, homeDir);
    if (!fixture) {
      return;
    }
    const plan = await projectData.createShotPlan({
      projectName: 'constantinople',
      homeDir,
      sceneId: fixture.sceneId,
      title: 'Facts',
      coverage: {
        beatSheetId: 'scene_beat_sheet_private',
        beatIds: ['beat_private'],
      },
      shots: [
        {
          description: 'This must never enter generation facts.',
          brief: { camera: { angle: 'secret angle' } },
        },
      ],
    });
    const context = await projectData.buildGenerationContext({
      projectName: 'constantinople',
      homeDir,
      purpose: 'shot-plan.video',
      target: { kind: 'shotPlan', id: plan.shotPlan.id },
    });
    expect(context.outputMediaKind).toBe('video');
    expect(context.facts).not.toHaveProperty('contextText');
    expect(JSON.stringify(context.facts)).not.toContain('private');
    expect(JSON.stringify(context.facts)).not.toContain('secret angle');
    expect(
      context.referenceGuide.sections
        .flatMap((section) => section.slots)
        .map((slot) => slot.id)
    ).toEqual(
      expect.arrayContaining([
        'production-lookbook-sheet',
        'storyboard-lookbook-sheet',
        'character-sheet',
        'location-sheet',
        'first-frame',
        'last-frame',
        'video-storyboard',
        'previs',
      ])
    );
  });
});

async function createProjectFixture(
  projectData: ReturnType<typeof createProjectDataService>,
  homeDir: string
): Promise<{ sceneId: string; projectFolder: string } | null> {
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
  return { sceneId, projectFolder: created.projectPath };
}

async function createPlan(
  projectData: ReturnType<typeof createProjectDataService>,
  homeDir: string,
  sceneId: string,
  title = 'Plan'
) {
  return projectData.createShotPlan({
    projectName: 'constantinople',
    homeDir,
    sceneId,
    title,
    coverage: null,
    shots: [{ description: 'One shot.', brief: {} }],
  });
}
