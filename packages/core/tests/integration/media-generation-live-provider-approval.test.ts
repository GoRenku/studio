import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as studioEngines from '@gorenku/studio-engines';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ImageEditGenerationSpec,
  ImageEditModelChoice,
  ProjectRelativePath,
} from '../../src/client/index.js';
import {
  createProjectDataService,
  type ProjectDataService,
} from '../../src/server/index.js';
import { createTestAssetFixture } from '../../src/server/testing/asset-fixture-helpers.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../../src/server/testing/project-data-fixtures.js';

describe('media generation live provider approval integration', () => {
  let homeDir: string;
  let projectData: ProjectDataService;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'renku-generation-live-approval-')
    );
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    projectData = createProjectDataService();
    await createSampleMovieProject({ projectData, homeDir });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns display-only estimates without public approval artifacts', async () => {
    const source = await registerSourceImage(
      homeDir,
      'visual-language/lookbook/estimate-source.png'
    );
    const spec = await createPersistedImageEditSpec(imageEditSpec(source.assetId));

    const estimate = await estimatePersistedSpec(spec.id);

    expect(estimate.estimate).toMatchObject({
      state: 'priced',
      provider: 'fal-ai',
      mediaKind: 'image',
    });
    expect(approvalArtifactKeys(estimate.estimate)).toEqual([]);
  });

  it('fails live provider runs without explicit approval before provider execution', async () => {
    const source = await registerSourceImage(
      homeDir,
      'visual-language/lookbook/missing-approval-source.png'
    );
    const spec = await createPersistedImageEditSpec(imageEditSpec(source.assetId));
    const runGeneration = vi
      .spyOn(studioEngines, 'runGeneration')
      .mockResolvedValue(successfulImageRun() as never);

    await expect(runPersistedSpec(spec.id, {})).rejects.toMatchObject({
      code: 'CORE_MEDIA_LIVE_PROVIDER_APPROVAL_REQUIRED',
    });
    expect(runGeneration).not.toHaveBeenCalled();
  });

  it('runs one approved live provider request and exposes no reusable approval artifact', async () => {
    const source = await registerSourceImage(
      homeDir,
      'visual-language/lookbook/approved-source.png'
    );
    const spec = await createPersistedImageEditSpec(imageEditSpec(source.assetId));
    const runGeneration = vi
      .spyOn(studioEngines, 'runGeneration')
      .mockResolvedValue(successfulImageRun() as never);

    const report = await runPersistedSpec(spec.id, {
      approveLiveProviderRun: true,
    });

    expect(runGeneration).toHaveBeenCalledTimes(1);
    expect(runGeneration).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'live' })
    );
    expect(report.run).toMatchObject({
      specId: spec.id,
      purpose: 'image.edit',
      simulated: false,
      status: 'completed',
    });
    expect(approvalArtifactKeys(report.run)).toEqual([]);
    expect(approvalArtifactKeys(report.run.estimateSnapshot)).toEqual([]);
  });

  it('runs simulated requests without live provider approval', async () => {
    const source = await registerSourceImage(
      homeDir,
      'visual-language/lookbook/simulated-source.png'
    );
    const spec = await createPersistedImageEditSpec(imageEditSpec(source.assetId));
    const runGeneration = vi
      .spyOn(studioEngines, 'runGeneration')
      .mockResolvedValue(successfulImageRun() as never);

    const report = await runPersistedSpec(spec.id, { simulate: true });

    expect(runGeneration).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'simulated' })
    );
    expect(report.run).toMatchObject({
      specId: spec.id,
      simulated: true,
      status: 'simulated',
    });
    expect(approvalArtifactKeys(report.run)).toEqual([]);
  });

  async function createPersistedImageEditSpec(spec: ImageEditGenerationSpec) {
    return projectData.createMediaGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      spec,
    });
  }

  async function estimatePersistedSpec(specId: string) {
    return projectData.estimateMediaGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      specId,
    });
  }

  async function runPersistedSpec(
    specId: string,
    input: { approveLiveProviderRun?: boolean; simulate?: boolean }
  ) {
    return projectData.runMediaGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      specId,
      ...input,
    });
  }

  async function registerSourceImage(projectHomeDir: string, projectRelativePath: string) {
    const projectPath = path.join(projectHomeDir, 'projects', 'constantinople');
    const absolutePath = path.join(projectPath, projectRelativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, 'image bytes');
    return createTestAssetFixture({
      projectName: 'constantinople',
      homeDir: projectHomeDir,
      target: { kind: 'project' },
      type: 'reference',
      mediaKind: 'image',
      title: 'Editable source',
      projectRelativePath: projectRelativePath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'reference',
    });
  }
});

function imageEditSpec(
  assetId: string,
  overrides: Partial<ImageEditGenerationSpec> = {}
): ImageEditGenerationSpec {
  return {
    purpose: 'image.edit',
    target: { kind: 'asset', id: assetId },
    modelChoice: 'fal-ai/openai/gpt-image-2/edit' as ImageEditModelChoice,
    prompt: 'Preserve everything except the requested correction.',
    parameterValues: {
      image_size: { width: 1024, height: 768 },
      quality: 'high',
      output_format: 'png',
      num_images: 1,
    },
    title: 'Source correction',
    ...overrides,
  };
}

function approvalArtifactKeys(value: unknown): string[] {
  if (!value || typeof value !== 'object') {
    return [];
  }
  return Object.keys(value).filter((key) => /approval/i.test(key));
}

function successfulImageRun() {
  return {
    outputs: [
      {
        artifactId: 'generated-image',
        mimeType: 'image/png',
        projectRelativePath: 'generated/media/source-correction-v01.png',
      },
    ],
    diagnostics: {},
  };
}
