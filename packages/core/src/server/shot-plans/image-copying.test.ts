import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProjectDataService } from '../project-data-service.js';
import { createSampleMovieProject, writeConfig } from '../testing/project-data-fixtures.js';

describe('Shot image copying', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-shot-image-copy-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
  });

  it('copies immutable generation provenance with the selected image', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const screenplay = await projectData.readScreenplayStructure({
      projectName: 'constantinople',
      homeDir,
    });
    const sceneId = screenplay.screenplay.scenes[0]?.id;
    if (!sceneId) {
      throw new Error('Expected a Scene fixture.');
    }
    const plan = await projectData.createShotPlan({
      projectName: 'constantinople',
      homeDir,
      sceneId,
      title: 'Plan',
      coverage: null,
      shots: [{ title: 'One shot', description: 'One shot.', brief: {} }],
    });
    const shot = plan.shotPlan.shots[0]!;
    await fs.mkdir(path.join(created.projectPath, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(created.projectPath, 'tmp', 'shot.png'), 'image');
    const provenance = {
      provider: 'codex',
      model: 'gpt-image-2',
      mediaKind: 'image' as const,
      prompt: 'An exact Shot image.',
      request: {
        prompt: 'An exact Shot image.',
        image: { $file: 'tmp/reference.png', mimeType: 'image/png', reviewLabel: 'Shot image source' },
      },
    };
    const attached = await projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'shot.image',
      target: { kind: 'shot', id: shot.id },
      sourceProjectRelativePath: 'tmp/shot.png',
      title: 'Selected candidate',
      generationProvenance: provenance,
      select: true,
    });

    const copied = await projectData.copyShotPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
    });
    const copiedImage = copied.shotPlan.shots[0]?.images[0];

    expect(attached.asset.generationProvenance).toEqual(provenance);
    expect(copiedImage?.id).not.toBe(attached.asset.id);
    expect(copiedImage?.generationProvenance).toEqual(provenance);
    expect(copiedImage?.files[0]?.projectRelativePath)
      .not.toBe(attached.asset.files[0]?.projectRelativePath);
  });
});
