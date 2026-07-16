import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { createProjectDataService } from '../../src/server/index.js';
import { writeConfig } from '../../src/server/testing/project-data-fixtures.js';
import { createIsolatedSampleMovieProjectFromTemplate } from '../../src/server/testing/movie-project-template-fixtures.js';

describe('context-first generation lifecycle', () => {
  let homeDir: string;
  const projectName = 'constantinople';
  const projectData = createProjectDataService();

  beforeAll(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-generation-integration-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    const project = await createIsolatedSampleMovieProjectFromTemplate({
      homeDir,
      projectData,
    });
    if (!project) {
      throw new Error('Expected the sample movie project fixture.');
    }
  });

  it('projects, estimates, simulates, and attaches one exact Cast Profile request', async () => {
    const context = await projectData.buildGenerationContext({
      homeDir,
      projectName,
      purpose: 'cast.profile',
      target: { kind: 'castMember', id: 'cast_test0002' },
    });
    expect(context.settings).toMatchObject({
      fixed: [{ kind: 'aspect-ratio', value: '1:1' }],
      recommended: [{ kind: 'quality', value: 'medium' }],
    });

    const created = await projectData.createGenerationSpec({
      homeDir,
      projectName,
      spec: {
        purpose: 'cast.profile',
        target: { kind: 'castMember', id: 'cast_test0002' },
        model: { provider: 'fal-ai', model: 'nano-banana-2' },
        values: { prompt: 'An exact opaque profile prompt.' },
        references: [],
      },
    });
    expect(created.spec.values).toMatchObject({ aspect_ratio: '1:1' });
    expect(created.spec.values).not.toHaveProperty('resolution');

    const estimate = await projectData.estimateGeneration({
      homeDir,
      projectName,
      specId: created.id,
    });
    expect(estimate.valid).toBe(true);
    if (!estimate.valid) return;

    const run = await projectData.runGeneration({
      homeDir,
      projectName,
      specId: created.id,
      approvalToken: estimate.estimate.approvalToken,
      mode: 'simulated',
    });
    expect(run.valid).toBe(true);
    if (!run.valid) return;
    expect(run.run.status).toBe('simulated');
    expect(run.run.outputs).toHaveLength(1);

    const output = run.run.outputs[0]!;
    if (!output.projectRelativePath) {
      throw new Error('Expected a simulated project-relative output path.');
    }
    const attachment = await projectData.attachGenerationMedia({
      homeDir,
      projectName,
      purpose: 'cast.profile',
      target: { kind: 'castMember', id: 'cast_test0002' },
      sourceProjectRelativePath: output.projectRelativePath,
      receipt: { run: run.run },
    });
    expect(attachment.provenance).toEqual({ generationRunId: run.run.id });

    const reusable = await projectData.listGenerationReferences({
      homeDir,
      projectName,
      mediaKind: 'image',
    });
    expect(reusable.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reference: expect.objectContaining({ assetId: attachment.asset.assetId }),
        provenance: { origin: 'generated', generationRunId: run.run.id },
      }),
    ]));
  });

  it('keeps an external attachment target-owned while exposing it in the generic catalog', async () => {
    const current = await projectData.readCurrentProject({ homeDir });
    if (!current) throw new Error('Expected current project.');
    const source = 'tmp/media/external-profile.png';
    const absoluteSource = path.join(current.projectFolder, source);
    await fs.mkdir(path.dirname(absoluteSource), { recursive: true });
    await fs.writeFile(absoluteSource, Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
      'base64'
    ));

    const attachment = await projectData.attachGenerationMedia({
      homeDir,
      projectName,
      purpose: 'cast.profile',
      target: { kind: 'castMember', id: 'cast_test0002' },
      sourceProjectRelativePath: source,
      title: 'External profile',
    });
    expect(attachment.provenance).toBeNull();

    const reusable = await projectData.listGenerationReferences({
      homeDir,
      projectName,
      mediaKind: 'image',
    });
    expect(reusable.items.some((item) =>
      item.reference.kind === 'asset-file' &&
      item.reference.assetId === attachment.asset.assetId
    )).toBe(true);

    const owned = await projectData.listGenerationReferences({
      homeDir,
      projectName,
      mediaKind: 'image',
      owner: { kind: 'castMember', id: 'cast_test0002' },
    });
    expect(owned.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reference: expect.objectContaining({ assetId: attachment.asset.assetId }),
        provenance: { origin: 'external' },
      }),
    ]));
  });
});
