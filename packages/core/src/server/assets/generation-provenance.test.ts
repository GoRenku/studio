import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProjectDataService } from '../project-data-service.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { createSampleMovieProject, writeConfig } from '../testing/project-data-fixtures.js';
import { setAssetGenerationProvenance } from './generation-provenance.js';

describe('Asset generation provenance', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-asset-provenance-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
  });

  it('persists an unsigned provider output URL in the attachment receipt', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    await fs.mkdir(path.join(created.projectPath, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(created.projectPath, 'tmp', 'image.png'), 'image');
    const generationProvenance = {
      provider: 'fal-ai',
      model: 'fal-ai/example-image-model',
      mediaKind: 'image' as const,
      prompt: 'A generated image',
      request: { prompt: 'A generated image' },
      receipt: {
        requestId: 'fal_job_1',
        output: {
          image: {
            url: 'https://v3b.fal.media/files/output.png',
            content_type: 'image/png',
          },
        },
      },
    };

    const attached = await projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'project.cover',
      target: { kind: 'project', id: 'project' },
      sourceProjectRelativePath: 'tmp/image.png',
      generationProvenance,
    });

    expect(attached.generationProvenance).toEqual(generationProvenance);
    const assets = await projectData.listAssets({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'project' },
    });
    expect(assets.find((asset) => asset.id === attached.asset.id)?.generationProvenance)
      .toEqual(generationProvenance);
  });

  it('rejects a different second provenance value without replacing the first', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    await fs.mkdir(path.join(created.projectPath, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(created.projectPath, 'tmp', 'image.png'), 'image');
    const attached = await projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'project.cover',
      target: { kind: 'project', id: 'project' },
      sourceProjectRelativePath: 'tmp/image.png',
    });
    const first = {
      provider: 'codex',
      model: 'gpt-image-2',
      mediaKind: 'image' as const,
      prompt: 'First prompt',
      request: { prompt: 'First prompt' },
    };
    const second = { ...first, prompt: 'Second prompt', request: { prompt: 'Second prompt' } };
    const opened = await openProjectSession({ projectName: 'constantinople', homeDir });
    try {
      setAssetGenerationProvenance(opened.session, {
        assetId: attached.asset.id,
        generationProvenance: first,
      });
      expect(() => setAssetGenerationProvenance(opened.session, {
        assetId: attached.asset.id,
        generationProvenance: second,
      })).toThrowError(expect.objectContaining({
        code: 'CORE_MEDIA_GENERATION_PROVENANCE_CONFLICT',
      }));
    } finally {
      opened.session.close();
    }
    const assets = await projectData.listAssets({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'project' },
    });
    expect(assets.find((asset) => asset.id === attached.asset.id)?.generationProvenance)
      .toEqual(first);
  });
});
