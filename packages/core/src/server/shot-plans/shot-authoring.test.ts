import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProjectDataService } from '../project-data-service.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';
import {
  parseStoredShotBrief,
  serializeShotBrief,
} from './validation.js';

describe('Shot Plan focused authoring', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'renku-shot-authoring-')
    );
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
  });

  it('validates current tagged documents with catalog or custom brief values', async () => {
    const projectData = createProjectDataService();
    const report = await projectData.validateShotPlanDocument({
      document: {
        kind: 'shot',
        title: 'Dust crosses the wall',
        description: 'Exact opaque Markdown.',
        brief: {
          durationSeconds: 3.5,
          framing: { start: 'wide-shot', end: 'Close on falling dust' },
          camera: { angle: 'eye-level' },
          motion: { movement: 'Wind-carried lateral drift' },
          optics: { intent: 'Keep the wall and dust in shared focus' },
          lighting: { intent: 'Cold dawn through powder haze' },
        },
      },
    });
    expect(report).toMatchObject({
      valid: true,
      document: {
        kind: 'shot',
        brief: {
          framing: {
            start: 'wide-shot',
            end: 'Close on falling dust',
          },
        },
      },
    });

    await expect(
      projectData.validateShotPlanDocument({
        document: {
          kind: 'shot',
          title: 'Invalid duration',
          description: '',
          brief: { durationSeconds: 0 },
        },
      })
    ).rejects.toMatchObject({ code: 'CORE_SHOT_PLAN_INVALID' });
  });

  it('owns the complete depth vocabulary and preserves creative text exactly', async () => {
    const projectData = createProjectDataService();
    const exactDescription =
      '## Intent\n\nKeep **unusual authored language** and @unknown exact.';
    const exactOpticsIntent = '<not-markup> Hold the foreground.';
    const exactFocusTarget = 'near plane: @unknown';
    const exactLightingIntent = '**Do not interpret this as Markdown.**';

    for (const depthOfField of ['shallow', 'deep'] as const) {
      const brief = {
        optics: {
          intent: exactOpticsIntent,
          focalLengthMm: 50,
          depthOfField,
          focusTarget: exactFocusTarget,
        },
        lighting: { intent: exactLightingIntent },
      };
      const report = await projectData.validateShotPlanDocument({
        document: {
          kind: 'shot',
          title: `${depthOfField} focus`,
          description: exactDescription,
          brief,
        },
      });

      expect(report.document).toMatchObject({
        description: exactDescription,
        brief,
      });
      expect(parseStoredShotBrief(serializeShotBrief(brief), 'shot_exact'))
        .toEqual(brief);
    }

    const withoutDepth = await projectData.validateShotPlanDocument({
      document: {
        kind: 'shot',
        title: 'Unspecified depth',
        description: exactDescription,
        brief: { optics: { intent: exactOpticsIntent } },
      },
    });
    expect(withoutDepth.document).toMatchObject({
      brief: { optics: { intent: exactOpticsIntent } },
    });

    await expect(
      projectData.validateShotPlanDocument({
        document: {
          kind: 'shot',
          title: 'Unsupported depth',
          description: exactDescription,
          brief: { optics: { depthOfField: 'medium' } },
        },
      })
    ).rejects.toMatchObject({ code: 'CORE_SHOT_PLAN_INVALID' });

    expect(() =>
      parseStoredShotBrief(
        JSON.stringify({ optics: { depthOfField: 'medium' } }),
        'shot_invalid'
      )
    ).toThrowError(
      expect.objectContaining({ code: 'CORE_SHOT_PLAN_STORAGE_INVALID' })
    );
  });

  it('updates, adds, moves, removes, and restores one Shot without aggregate replacement', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const screenplay = await projectData.readScreenplayStructure({ projectName: 'constantinople', homeDir });
    const sceneId = screenplay.screenplay.scenes[0]?.id;
    if (!sceneId) {
      return;
    }
    const plan = await projectData.createShotPlan({
      projectName: 'constantinople',
      homeDir,
      sceneId,
      title: 'Focused authoring',
      coverage: null,
      shots: [
        { title: 'First', description: 'First.', brief: {} },
        { title: 'Second', description: 'Second.', brief: {} },
      ],
    });
    const firstShotId = plan.shotPlan.shots[0]!.id;
    const secondShotId = plan.shotPlan.shots[1]!.id;
    expect(plan.shotPlan).toMatchObject({ number: 1 });
    expect(plan.shotPlan.shots.map((shot) => shot.number)).toEqual(['1', '2']);

    await projectData.updateShotInPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
      shotId: secondShotId,
      shot: {
        title: 'Second revised',
        description: 'Second revised.',
        brief: { durationSeconds: 2 },
      },
    });
    const moved = await projectData.moveShotInPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
      shotId: secondShotId,
      position: 0,
    });
    expect(moved.shotPlan.shots.map((shot) => shot.title)).toEqual([
      'Second revised',
      'First',
    ]);
    expect(moved.shotPlan.shots.map((shot) => shot.position)).toEqual([0, 1]);
    expect(moved.shotPlan.shots.map((shot) => shot.number)).toEqual(['2', '1']);

    const added = await projectData.addShotToPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
      shot: { title: 'Third', description: 'Third.', brief: {} },
    });
    expect(added.shotPlan.shots.map((shot) => shot.title)).toEqual([
      'Second revised',
      'First',
      'Third',
    ]);
    expect(added.shotPlan.shots.map((shot) => shot.number)).toEqual(['2', '1', '3']);

    const inserted = await projectData.addShotToPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
      placement: { position: 'before', shotId: firstShotId },
      shot: { title: 'Inserted', description: 'Inserted.', brief: {} },
    });
    expect(inserted.shotPlan.shots.map((shot) => shot.number)).toEqual([
      '2', '2A', '1', '3',
    ]);
    await expect(
      projectData.moveShotInPlan({
        projectName: 'constantinople',
        homeDir,
        shotPlanId: plan.shotPlan.id,
        shotId: firstShotId,
        position: 4,
      })
    ).rejects.toMatchObject({ code: 'CORE_SHOT_PLAN_INVALID' });

    const otherPlan = await projectData.createShotPlan({
      projectName: 'constantinople',
      homeDir,
      sceneId,
      title: 'Other plan',
      coverage: null,
      shots: [],
    });
    await expect(
      projectData.updateShotInPlan({
        projectName: 'constantinople',
        homeDir,
        shotPlanId: otherPlan.shotPlan.id,
        shotId: secondShotId,
        shot: { title: 'Wrong owner', description: '', brief: {} },
      })
    ).rejects.toMatchObject({ code: 'CORE_SHOT_PLAN_SHOT_MISMATCH' });

    const removed = await projectData.removeShotFromPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
      shotId: secondShotId,
    });
    const withoutShot = await projectData.readShotPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
    });
    expect(withoutShot.shotPlan.shots.map((shot) => shot.title)).toEqual([
      'Inserted',
      'First',
      'Third',
    ]);
    expect(withoutShot.shotPlan.shots.map((shot) => shot.position)).toEqual([
      0, 1, 2,
    ]);

    await projectData.restoreTrashItem({
      projectName: 'constantinople',
      homeDir,
      trashItemId: removed.recovery.trashItemIds[0]!,
    });
    const restored = await projectData.readShotPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
    });
    expect(restored.shotPlan.shots.map((shot) => shot.title)).toEqual([
      'Second revised',
      'Inserted',
      'First',
      'Third',
    ]);
    expect(restored.shotPlan.shots.map((shot) => shot.position)).toEqual([
      0, 1, 2, 3,
    ]);
    expect(restored.shotPlan.shots.map((shot) => shot.number)).toEqual([
      '2', '2A', '1', '3',
    ]);

    const fourth = await projectData.addShotToPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
      shot: { title: 'Fourth', description: 'Fourth.', brief: {} },
    });
    expect(fourth.shotPlan.shots.at(-1)?.number).toBe('4');

    await Promise.all([
      projectData.addShotToPlan({
        projectName: 'constantinople',
        homeDir,
        shotPlanId: plan.shotPlan.id,
        shot: { title: 'Fifth', description: 'Fifth.', brief: {} },
      }),
      projectData.addShotToPlan({
        projectName: 'constantinople',
        homeDir,
        shotPlanId: plan.shotPlan.id,
        shot: { title: 'Sixth', description: 'Sixth.', brief: {} },
      }),
    ]);
    const afterConcurrentAdds = await projectData.readShotPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
    });
    expect(afterConcurrentAdds.shotPlan.shots
      .filter((shot) => shot.title === 'Fifth' || shot.title === 'Sixth')
      .map((shot) => shot.number)
      .sort()).toEqual(['5', '6']);
  });
});
