import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type {
  AssetOwner,
  MediaGenerationProvenance,
  ProjectRelativePath,
} from '../../client/index.js';
import { insertAssetFileRecord } from '../database/access/asset-files.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { createRandomIdGenerator, type ProjectIdGenerator } from '../entity-ids.js';
import { createProjectDataService } from '../project-data-service.js';
import { createTestAssetFixture } from '../testing/asset-fixture-helpers.js';
import { createSampleMovieProject, writeConfig } from '../testing/project-data-fixtures.js';
import { attachVideoEditMedia } from './attachment.js';

describe('video.edit source-derived attachment', () => {
  let homeDir: string;
  let projectFolder: string;
  const projectData = createProjectDataService();

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-video-edit-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      throw new Error('Expected a sample Project.');
    }
    projectFolder = created.projectPath;
  });

  it('accepts arbitrary video types across representative Asset owners', async () => {
    const screenplay = await projectData.readScreenplayStructure({
      projectName: 'constantinople',
      homeDir,
    });
    const sceneId = screenplay.screenplay.scenes[0]!.id;
    const plan = await projectData.createShotPlan({
      type: 'shot-list',
      projectName: 'constantinople',
      homeDir,
      sceneId,
      title: 'Video owner matrix',
      coverage: null,
      shots: [{ title: 'Wide', description: 'Wide.', brief: {} }],
    });
    const cases: Array<[string, AssetOwner]> = [
      ['project_research_video', { kind: 'project' }],
      ['cast_rehearsal_video', { kind: 'castMember', id: 'cast_test0002' }],
      ['scene_reference_video', { kind: 'scene', id: sceneId }],
      ['shot_alternate_video', { kind: 'shot', id: plan.shotPlan.shots[0]!.id }],
    ];
    for (const [type, owner] of cases) {
      const sourcePath = `media/${type}/source.mp4` as ProjectRelativePath;
      const outputPath = `tmp/${type}-output.mp4` as ProjectRelativePath;
      await writeFile(sourcePath, 'source');
      await writeFile(outputPath, 'output');
      const source = await createTestAssetFixture({
        projectName: 'constantinople',
        homeDir,
        owner,
        locale: { localeId: 'locale_test0001' },
        type,
        mediaKind: 'video',
        title: 'Source title',
        oneLineSummary: 'Source summary',
        referenceName: 'source-reference',
        tags: ['continuity'],
        projectRelativePath: sourcePath,
        fileRole: 'primary',
      });

      const context = await projectData.readMediaGenerationContext({
        projectName: 'constantinople',
        homeDir,
        purpose: 'video.edit',
        target: { kind: 'asset', id: source.id },
      });
      expect(context.suggestedReferences).toEqual([
        expect.objectContaining({
          id: 'source-video',
          role: 'source-video',
          candidates: [expect.objectContaining({
            assetId: source.id,
            assetFileId: source.files[0]!.id,
            mediaKind: 'video',
          })],
        }),
      ]);

      const report = await projectData.attachGenerationMedia({
        projectName: 'constantinople',
        homeDir,
        purpose: 'video.edit',
        target: { kind: 'asset', id: source.id },
        sourceProjectRelativePath: outputPath,
        generationProvenance: provenance(sourcePath),
      });
      expect(report.asset.id).not.toBe(source.id);
      expect(report.asset).toMatchObject({
        owner,
        localeId: 'locale_test0001',
        type,
        title: 'Source title',
        oneLineSummary: 'Source summary',
        referenceName: 'source-reference',
        tags: ['continuity'],
        authoredFrom: null,
      });
      expect(report.asset.files).toEqual([
        expect.objectContaining({
          role: 'primary',
          mediaKind: 'video',
          projectRelativePath: expect.stringMatching(
            new RegExp(`^media/${type}/edited-video-g[a-z0-9]+\\.mp4$`),
          ),
        }),
      ]);
    }
  });

  it('preserves weak Shot Plan context and does not replace the source candidate', async () => {
    const screenplay = await projectData.readScreenplayStructure({
      projectName: 'constantinople',
      homeDir,
    });
    const plan = await projectData.createShotPlan({
      type: 'shot-list',
      homeDir,
      sceneId: screenplay.screenplay.scenes[0]!.id,
      title: 'Continuation plan',
      coverage: null,
      shots: [],
    });
    const sourceOutput = 'tmp/shot-plan-source.mp4' as ProjectRelativePath;
    const editOutput = 'tmp/shot-plan-edit.mp4' as ProjectRelativePath;
    await writeFile(sourceOutput, 'source');
    await writeFile(editOutput, 'edit');
    const source = await projectData.attachGenerationMedia({
      homeDir,
      purpose: 'shot-plan.video-generation',
      target: { kind: 'shotPlan', id: plan.shotPlan.id },
      sourceProjectRelativePath: sourceOutput,
      generationProvenance: {
        provider: 'fal-ai',
        model: 'video/create',
        mediaKind: 'video',
        prompt: 'Create source.',
        request: { prompt: 'Create source.' },
      },
    });
    const edited = await projectData.attachGenerationMedia({
      homeDir,
      purpose: 'video.edit',
      target: { kind: 'asset', id: source.asset.id },
      sourceProjectRelativePath: editOutput,
      generationProvenance: provenance(source.asset.files[0]!.projectRelativePath),
    });
    expect(edited.asset.authoredFrom).toEqual({ kind: 'shotPlan', id: plan.shotPlan.id });
    expect(edited.asset.owner).toEqual(source.asset.owner);
    expect(edited.resourceKeys).toEqual([
      'surface:project:assets',
      `surface:scene:${screenplay.screenplay.scenes[0]!.id}:video-generations`,
    ]);
    const videos = await projectData.listSceneShotPlanVideoGenerations({
      homeDir,
      sceneId: screenplay.screenplay.scenes[0]!.id,
    });
    expect(videos.groups.flatMap((group) => group.assets.map((asset) => asset.id))).toEqual(
      expect.arrayContaining([source.asset.id, edited.asset.id]),
    );
  });

  it('rejects missing, ambiguous, wrong-kind, unavailable, and discarded sources before a write', async () => {
    const sourcePath = 'media/failure/source.mp4' as ProjectRelativePath;
    const secondPath = 'media/failure/second.mp4' as ProjectRelativePath;
    const outputPath = 'tmp/failure-output.mp4' as ProjectRelativePath;
    await writeFile(sourcePath, 'source');
    await writeFile(secondPath, 'second');
    await writeFile(outputPath, 'output');
    const source = await createTestAssetFixture({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'project' },
      type: 'arbitrary_video',
      mediaKind: 'video',
      title: 'Source',
      projectRelativePath: sourcePath,
      fileRole: 'primary',
    });
    const session = await openProjectSession({ projectName: 'constantinople', homeDir });
    try {
      insertAssetFileRecord(session.session, {
        id: createRandomIdGenerator().next('asset_file'),
        assetId: source.id,
        role: 'alternate',
        projectRelativePath: secondPath,
        mediaKind: 'video',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } finally {
      session.session.close();
    }

    await expect(edit(source.id, outputPath, provenance('media/missing.mp4' as ProjectRelativePath)))
      .rejects.toMatchObject({ code: 'CORE_VIDEO_EDIT_SOURCE_REFERENCE_MISSING' });
    await expect(edit(source.id, outputPath, provenance(sourcePath, secondPath)))
      .rejects.toMatchObject({ code: 'CORE_VIDEO_EDIT_SOURCE_REFERENCE_AMBIGUOUS' });
    await expect(edit(source.id, outputPath, provenance(sourcePath, sourcePath)))
      .rejects.toMatchObject({ code: 'CORE_VIDEO_EDIT_SOURCE_REFERENCE_AMBIGUOUS' });
    await expect(edit(source.id, outputPath, { ...provenance(sourcePath), mediaKind: 'image' as const }))
      .rejects.toMatchObject({ code: 'CORE_MEDIA_GENERATION_PROVENANCE_INVALID' });

    await fs.unlink(path.join(projectFolder, sourcePath));
    await expect(edit(source.id, outputPath, provenance(sourcePath)))
      .rejects.toMatchObject({ code: 'CORE_VIDEO_EDIT_SOURCE_INVALID' });
    await writeFile(sourcePath, 'source');
    await projectData.discardAsset({
      projectName: 'constantinople',
      homeDir,
      assetId: source.id,
      owner: { kind: 'project' },
    });
    await expect(edit(source.id, outputPath, provenance(sourcePath)))
      .rejects.toMatchObject({ code: 'CORE_VIDEO_EDIT_SOURCE_INVALID' });
  });

  it('rolls back the copied file and database rows when persistence fails after allocation', async () => {
    const sourcePath = 'media/rollback/source.mp4' as ProjectRelativePath;
    const outputPath = 'tmp/rollback-output.mp4' as ProjectRelativePath;
    await writeFile(sourcePath, 'source');
    await writeFile(outputPath, 'output');
    const source = await createTestAssetFixture({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'project' },
      type: 'rollback_video',
      mediaKind: 'video',
      title: 'Rollback source',
      projectRelativePath: sourcePath,
      fileRole: 'primary',
    });
    const session = await openProjectSession({ projectName: 'constantinople', homeDir });
    try {
      const idGenerator = {
        next(kind: string) {
          return kind === 'asset' ? 'asset_rollback' : source.files[0]!.id;
        },
      } as ProjectIdGenerator;
      expect(() => attachVideoEditMedia({
        purpose: 'video.edit',
        target: { kind: 'asset', id: source.id },
        sourceProjectRelativePath: outputPath,
        generationProvenance: provenance(sourcePath),
        session: session.session,
        projectFolder,
        idGenerator,
      })).toThrow();
    } finally {
      session.session.close();
    }
    expect(await fs.readdir(path.join(projectFolder, 'media/rollback'))).toEqual(['source.mp4']);
    const assets = await projectData.listAssets({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'project' },
    });
    expect(assets.some((asset) => asset.id === 'asset_rollback')).toBe(false);
  });

  function edit(
    assetId: string,
    outputPath: ProjectRelativePath,
    generationProvenance: MediaGenerationProvenance,
  ) {
    return projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'video.edit',
      target: { kind: 'asset', id: assetId },
      sourceProjectRelativePath: outputPath,
      generationProvenance,
    });
  }

  async function writeFile(relativePath: ProjectRelativePath, contents: string) {
    const absolutePath = path.join(projectFolder, relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, contents);
  }
});

function provenance(...sourcePaths: ProjectRelativePath[]) {
  return {
    provider: 'fal-ai',
    model: 'video/edit',
    mediaKind: 'video' as const,
    prompt: 'Preserve the source and extend one action.',
    request: {
      prompt: 'Preserve the source and extend one action.',
      references: sourcePaths.map((sourcePath) => ({
        $file: sourcePath,
        mimeType: 'video/mp4',
        reviewLabel: 'Exact source video',
      })),
    },
  };
}
