import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AssetOwner, ProjectRelativePath } from '../../client/index.js';
import { createDeterministicIdGenerator } from '../entity-ids.js';
import { createProjectDataService } from '../project-data-service.js';
import { createTestAssetFixture } from '../testing/asset-fixture-helpers.js';
import { createSampleMovieProject, writeConfig } from '../testing/project-data-fixtures.js';

describe('image.edit source-derived attachment continuation', () => {
  let homeDir: string;
  let projectFolder: string;
  const projectData = createProjectDataService();

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-image-edit-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      throw new Error('Expected a sample Project.');
    }
    projectFolder = created.projectPath;
    await projectData.applyPropOperations({
      homeDir,
      idGenerator: createDeterministicIdGenerator(),
      document: {
        kind: 'propOperations',
        operations: [{
          operation: 'prop.add',
          prop: { key: 'bronze-seal', handle: 'bronze-seal', name: 'Bronze seal' },
        }],
      },
    });
  });

  it.each([
    ['project_cover', { kind: 'project' }, 'covers/cover-g', 'surface:project:covers'],
    ['cast_profile', { kind: 'castMember', id: 'cast_test0002' }, 'cast/mehmed-ii/profile-g', 'surface:castMember:cast_test0002'],
    ['character_sheet', { kind: 'castMember', id: 'cast_test0002' }, 'cast/mehmed-ii/continuity-sheet-g', 'surface:castMember:cast_test0002'],
    ['location_hero', { kind: 'location', id: 'location_test0001' }, 'locations/council-chamber/hero-g', 'surface:location:location_test0001'],
    ['location_sheet', { kind: 'location', id: 'location_test0001' }, 'locations/council-chamber/continuity-sheet-g', 'surface:location:location_test0001'],
    ['prop_hero', { kind: 'prop', id: 'prop_test0001' }, 'props/bronze-seal/hero-g', 'surface:prop:prop_test0001'],
    ['prop_sheet', { kind: 'prop', id: 'prop_test0001' }, 'props/bronze-seal/continuity-sheet-g', 'surface:prop:prop_test0001'],
  ] as const)(
    'keeps %s beside its exact current owner',
    async (type, owner, destinationPrefix, resourceKey) => {
      const sourcePath = `tmp/source-${type}.png` as ProjectRelativePath;
      const outputPath = `tmp/output-${type}.png` as ProjectRelativePath;
      await writeImage(sourcePath);
      await writeImage(outputPath);
      const source = await createTestAssetFixture({
        projectName: 'constantinople',
        homeDir,
        owner: owner as AssetOwner,
        type,
        mediaKind: 'image',
        title: 'Source title',
        oneLineSummary: 'Source summary',
        projectRelativePath: sourcePath,
        fileRole: 'primary',
        referenceName: 'continuity',
        tags: ['source-tag'],
      });

      const report = await projectData.attachGenerationMedia({
        projectName: 'constantinople',
        homeDir,
        purpose: 'image.edit',
        target: { kind: 'asset', id: source.id },
        sourceProjectRelativePath: outputPath,
        generationProvenance: provenance(sourcePath),
      });

      expect(report.asset.id).not.toBe(source.id);
      expect(report.asset).toMatchObject({
        owner,
        type,
        title: 'Source title',
        oneLineSummary: 'Source summary',
        referenceName: 'continuity',
        tags: ['source-tag'],
      });
      expect(report.asset.files[0]?.projectRelativePath).toMatch(
        new RegExp(`^${destinationPrefix}[a-z0-9]+\\.png$`),
      );
      expect(report.resourceKeys).toContain(resourceKey);
    },
  );

  it('fails before copying output when provenance does not reference a current source file', async () => {
    const sourcePath = 'tmp/source-invalid.png' as ProjectRelativePath;
    const outputPath = 'tmp/output-invalid.png' as ProjectRelativePath;
    await writeImage(sourcePath);
    await writeImage(outputPath);
    const source = await createTestAssetFixture({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'location', id: 'location_test0001' },
      type: 'location_sheet',
      mediaKind: 'image',
      title: 'Source',
      projectRelativePath: sourcePath,
      fileRole: 'primary',
    });

    await expect(projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'image.edit',
      target: { kind: 'asset', id: source.id },
      sourceProjectRelativePath: outputPath,
      generationProvenance: provenance('tmp/another.png' as ProjectRelativePath),
    })).rejects.toMatchObject({ code: 'CORE_IMAGE_EDIT_SOURCE_REFERENCE_MISSING' });
    await expect(fs.readdir(path.join(projectFolder, 'locations/council-chamber')))
      .rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.each([
    ['character_sheet', { kind: 'project' }, 'CORE_IMAGE_EDIT_OWNER_INVALID'],
    ['lookbook_image', { kind: 'project' }, 'CORE_IMAGE_EDIT_OWNER_INVALID'],
    ['shot_image', { kind: 'project' }, 'CORE_IMAGE_EDIT_OWNER_INVALID'],
    ['scene_storyboard_image', { kind: 'project' }, 'CORE_IMAGE_EDIT_SURFACE_UNAVAILABLE'],
    ['shot_plan_video_first_frame', { kind: 'castMember', id: 'cast_test0002' }, 'CORE_IMAGE_EDIT_OWNER_INVALID'],
    ['unclassified_image', { kind: 'project' }, 'CORE_IMAGE_EDIT_CONTINUATION_UNSUPPORTED'],
  ] as const)(
    'rejects invalid %s continuation before adding another Asset',
    async (type, owner, code) => {
      const sourcePath = `tmp/source-${type}.png` as ProjectRelativePath;
      const outputPath = `tmp/output-${type}.png` as ProjectRelativePath;
      await writeImage(sourcePath);
      await writeImage(outputPath);
      const source = await createTestAssetFixture({
        projectName: 'constantinople',
        homeDir,
        owner: owner as AssetOwner,
        type,
        mediaKind: 'image',
        title: 'Invalid continuation source',
        projectRelativePath: sourcePath,
        fileRole: 'primary',
      });
      const before = await projectData.listAssets({
        projectName: 'constantinople', homeDir, owner: owner as AssetOwner,
      });

      await expect(projectData.attachGenerationMedia({
        projectName: 'constantinople',
        homeDir,
        purpose: 'image.edit',
        target: { kind: 'asset', id: source.id },
        sourceProjectRelativePath: outputPath,
        generationProvenance: provenance(sourcePath),
      })).rejects.toMatchObject({ code });

      const after = await projectData.listAssets({
        projectName: 'constantinople', homeDir, owner: owner as AssetOwner,
      });
      expect(after.map((asset) => asset.id)).toEqual(before.map((asset) => asset.id));
    },
  );

  it('keeps image.create and all four edited Plan image roles beside the exact Shot Plan', async () => {
    const screenplay = await projectData.readScreenplayStructure({
      projectName: 'constantinople',
      homeDir,
    });
    const plan = await projectData.createShotPlan({
      projectName: 'constantinople',
      homeDir,
      sceneId: screenplay.screenplay.scenes[0]!.id,
      title: 'Plan image continuations',
      coverage: null,
      shots: [],
    });
    const createdPath = 'tmp/generic-reference.png' as ProjectRelativePath;
    await writeImage(createdPath);
    const created = await projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'image.create',
      target: { kind: 'shotPlan', id: plan.shotPlan.id },
      sourceProjectRelativePath: createdPath,
      generationProvenance: generatedProvenance(),
    });
    expect(created.asset).toMatchObject({
      owner: { kind: 'project' },
      type: 'shot_plan_video_reference',
      authoredFrom: { kind: 'shotPlan', id: plan.shotPlan.id },
    });
    expect(created.asset.files[0]?.projectRelativePath).toMatch(
      /\/01-shot-plan\/reference-g[a-z0-9]+\.png$/,
    );

    for (const [purpose, type, stem] of [
      ['shot-plan.video-first-frame', 'shot_plan_video_first_frame', 'first-frame'],
      ['shot-plan.video-last-frame', 'shot_plan_video_last_frame', 'last-frame'],
      ['shot-plan.video-storyboard', 'shot_plan_video_storyboard', 'storyboard'],
      ['shot-plan.video-reference', 'shot_plan_video_reference', 'reference'],
    ] as const) {
      const sourcePath = `tmp/${stem}-source.png` as ProjectRelativePath;
      const editedPath = `tmp/${stem}-edited.png` as ProjectRelativePath;
      await writeImage(sourcePath);
      await writeImage(editedPath);
      const source = await projectData.attachGenerationMedia({
        projectName: 'constantinople',
        homeDir,
        purpose,
        target: { kind: 'shotPlan', id: plan.shotPlan.id },
        sourceProjectRelativePath: sourcePath,
        generationProvenance: generatedProvenance(),
      });
      const edited = await projectData.attachGenerationMedia({
        projectName: 'constantinople',
        homeDir,
        purpose: 'image.edit',
        target: { kind: 'asset', id: source.asset.id },
        sourceProjectRelativePath: editedPath,
        generationProvenance: provenance(source.asset.files[0]!.projectRelativePath),
      });
      expect(edited.asset).toMatchObject({
        owner: { kind: 'project' },
        type,
        authoredFrom: { kind: 'shotPlan', id: plan.shotPlan.id },
      });
      expect(edited.asset.files[0]?.projectRelativePath).toMatch(
        new RegExp(`/01-shot-plan/${stem}-g[a-z0-9]+\\.png$`),
      );
    }

    const projection = await projectData.readShotPlanImageAssets({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
    });
    expect(projection.groups.map((group) => group.role)).toEqual([
      'first-frame', 'last-frame', 'storyboard', 'reference',
    ]);
    expect(projection.groups.find((group) => group.role === 'reference')?.assets)
      .toHaveLength(3);
    const otherPlan = await projectData.createShotPlan({
      projectName: 'constantinople',
      homeDir,
      sceneId: screenplay.screenplay.scenes[0]!.id,
      title: 'Other plan',
      coverage: null,
      shots: [],
    });
    await expect(projectData.discardShotPlanImageAsset({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: otherPlan.shotPlan.id,
      assetId: created.asset.id,
    })).rejects.toMatchObject({ code: 'CORE_SHOT_PLAN_IMAGE_ASSETS_NOT_FOUND' });
    await projectData.discardShotPlanImageAsset({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
      assetId: created.asset.id,
    });
    const afterDiscard = await projectData.readShotPlanImageAssets({
      projectName: 'constantinople', homeDir, shotPlanId: plan.shotPlan.id,
    });
    expect(afterDiscard.groups.find((group) => group.role === 'reference')?.assets)
      .toHaveLength(2);
  });

  it('creates new ordered Lookbook detail rows beside image and sheet sources', async () => {
    const lookbook = await projectData.writeProductionLookbook({
      projectName: 'constantinople',
      homeDir,
      document: productionLookbookDocument(),
    });
    for (const [purpose, type, stem] of [
      ['lookbook.image', 'lookbook_image', 'continuity-g'],
      ['lookbook.video-sheet', 'lookbook_sheet', 'continuity-sheet-g'],
    ] as const) {
      const sourcePath = `tmp/${type}-source.png` as ProjectRelativePath;
      const editedPath = `tmp/${type}-edited.png` as ProjectRelativePath;
      await writeImage(sourcePath);
      await writeImage(editedPath);
      const source = await projectData.attachGenerationMedia({
        projectName: 'constantinople',
        homeDir,
        purpose,
        target: { kind: 'lookbook', id: lookbook.lookbook.id },
        sourceProjectRelativePath: sourcePath,
        title: 'Continuity',
        assetMetadata: { referenceName: 'continuity' },
      });
      const edited = await projectData.attachGenerationMedia({
        projectName: 'constantinople',
        homeDir,
        purpose: 'image.edit',
        target: { kind: 'asset', id: source.asset.id },
        sourceProjectRelativePath: editedPath,
        generationProvenance: provenance(source.asset.files[0]!.projectRelativePath),
      });
      expect(edited.ownerRecord).toMatchObject({
        kind: type === 'lookbook_image' ? 'lookbookImage' : 'lookbookSheet',
      });
      expect(edited.asset).toMatchObject({
        owner: { kind: 'lookbook', id: lookbook.lookbook.id },
        type,
      });
      expect(edited.asset.files[0]?.projectRelativePath).toMatch(
        new RegExp(`/production/${stem}[a-z0-9]+\\.png$`),
      );
    }
  });

  it('keeps edited Beat and Shot candidates unselected beside their exact source surfaces', async () => {
    const screenplay = await projectData.readScreenplayStructure({
      projectName: 'constantinople',
      homeDir,
    });
    const scene = screenplay.screenplay.scenes[0]!;
    const revision = await projectData.createSceneBeatsRevision({
      homeDir,
      idGenerator: createDeterministicIdGenerator(),
      document: {
        sceneId: scene.id,
        beats: [{
          title: 'Decision',
          description: 'The decision lands.',
          narrativeDevelopment: 'The scene turns.',
          narrativePurpose: 'Show the choice.',
          screenplayBlockIds: [scene.blocks[0]!.id],
          castMemberIds: [],
          locationIds: [],
          propIds: [],
        }],
      },
    });
    const beatSourcePath = 'tmp/beat-source.png' as ProjectRelativePath;
    const beatEditedPath = 'tmp/beat-edited.png' as ProjectRelativePath;
    await writeImage(beatSourcePath);
    await writeImage(beatEditedPath);
    const imported = await projectData.attachSceneStoryboardImages({
      projectName: 'constantinople',
      homeDir,
      sceneId: scene.id,
      sceneBeatsRevisionId: revision.activeRevisionId,
      document: {
        sceneBeatsRevisionId: revision.activeRevisionId,
        select: true,
        beats: [{ beatId: 'beat_test0001', source: beatSourcePath }],
      },
    });
    const beatSource = imported.imported[0]!;
    const beatEdited = await projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'image.edit',
      target: { kind: 'asset', id: beatSource.id },
      sourceProjectRelativePath: beatEditedPath,
      generationProvenance: provenance(beatSource.files[0]!.projectRelativePath),
    });
    const storyboardStatus = await projectData.readSceneStoryboardStatus({
      projectName: 'constantinople',
      homeDir,
      sceneId: scene.id,
      sceneBeatsRevisionId: revision.activeRevisionId,
    });
    expect(storyboardStatus.beats[0]).toMatchObject({ selectedImageId: beatSource.id });
    expect(storyboardStatus.beats[0]?.images.map((asset) => asset.id))
      .toContain(beatEdited.asset.id);
    await expect(projectData.selectSceneStoryboardImageCandidate({
      projectName: 'constantinople',
      homeDir,
      sceneId: scene.id,
      sceneBeatsRevisionId: 'scene_beats_revision_missing',
      beatId: 'beat_test0001',
      assetId: beatEdited.asset.id,
    })).rejects.toMatchObject({ code: 'CORE_SCENE_STORYBOARD_CANDIDATE_CONTEXT_INVALID' });
    const selectionReport = await projectData.selectSceneStoryboardImageCandidate({
      projectName: 'constantinople',
      homeDir,
      sceneId: scene.id,
      sceneBeatsRevisionId: revision.activeRevisionId,
      beatId: 'beat_test0001',
      assetId: beatEdited.asset.id,
    });
    expect(selectionReport.resourceKeys).toContain(
      `scene-beats:${revision.activeRevisionId}:beat:beat_test0001`,
    );
    const discardReport = await projectData.discardSceneStoryboardImageCandidate({
      projectName: 'constantinople',
      homeDir,
      sceneId: scene.id,
      sceneBeatsRevisionId: revision.activeRevisionId,
      beatId: 'beat_test0001',
      assetId: beatSource.id,
    });
    expect(discardReport.resourceKeys).toContain(
      `scene-beats:${revision.activeRevisionId}:beat:beat_test0001`,
    );
    const afterStoryboardMutation = await projectData.readSceneStoryboardStatus({
      projectName: 'constantinople',
      homeDir,
      sceneId: scene.id,
      sceneBeatsRevisionId: revision.activeRevisionId,
    });
    expect(afterStoryboardMutation.beats[0]).toMatchObject({
      selectedImageId: beatEdited.asset.id,
      images: [expect.objectContaining({ id: beatEdited.asset.id })],
    });

    const plan = await projectData.createShotPlan({
      projectName: 'constantinople',
      homeDir,
      sceneId: scene.id,
      title: 'Shot continuation',
      coverage: null,
      shots: [{ title: 'Wide', description: 'Wide shot.', brief: {} }],
    });
    const shot = plan.shotPlan.shots[0]!;
    const shotSourcePath = 'tmp/shot-source.png' as ProjectRelativePath;
    const shotEditedPath = 'tmp/shot-edited.png' as ProjectRelativePath;
    await writeImage(shotSourcePath);
    await writeImage(shotEditedPath);
    const shotSource = await projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'shot.image',
      target: { kind: 'shot', id: shot.id },
      sourceProjectRelativePath: shotSourcePath,
      select: true,
    });
    const shotEdited = await projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'image.edit',
      target: { kind: 'asset', id: shotSource.asset.id },
      sourceProjectRelativePath: shotEditedPath,
      generationProvenance: provenance(shotSource.asset.files[0]!.projectRelativePath),
    });
    const currentPlan = await projectData.readShotPlan({
      projectName: 'constantinople', homeDir, shotPlanId: plan.shotPlan.id,
    });
    expect(currentPlan.shotPlan.shots[0]?.selectedImageId).toBe(shotSource.asset.id);
    expect(currentPlan.shotPlan.shots[0]?.images.map((asset) => asset.id))
      .toContain(shotEdited.asset.id);
  });

  function writeImage(relativePath: ProjectRelativePath): Promise<void> {
    const absolutePath = path.join(projectFolder, relativePath);
    return fs.mkdir(path.dirname(absolutePath), { recursive: true })
      .then(() => fs.writeFile(absolutePath, 'image'));
  }
});

function provenance(sourcePath: ProjectRelativePath) {
  return {
    provider: 'fal-ai',
    model: 'openai/gpt-image-2/edit',
    mediaKind: 'image' as const,
    prompt: 'Preserve the source and change one detail.',
    request: {
      prompt: 'Preserve the source and change one detail.',
      image: {
        $file: sourcePath,
        mimeType: 'image/png',
        reviewLabel: 'Exact source image',
      },
    },
  };
}

function generatedProvenance() {
  return {
    provider: 'fal-ai',
    model: 'openai/gpt-image-2',
    mediaKind: 'image' as const,
    prompt: 'Generate one image.',
    request: { prompt: 'Generate one image.' },
  };
}

function productionLookbookDocument() {
  return {
    kind: 'productionLookbook' as const,
    productionLookbook: {
      name: 'Production Language',
      thesis: { statement: 'Held monumental frames.', principles: ['Keep scale legible.'] },
      palette: {
        description: 'Stone and ember.',
        colors: [{ hex: '#8A6437', name: 'Worked bronze', meaning: 'Engineered force.' }],
        observations: [],
      },
      toneMood: { tone: 'severe', moodTags: ['monumental'], description: 'Restrained pressure.' },
      composition: {
        description: 'Stable axes.',
        patterns: [{ name: 'Held center', description: 'Keep mass legible.' }],
      },
      lighting: {
        description: 'Low sun and fire.',
        patterns: [{ name: 'Ember edge', description: 'Use fire as a narrow accent.' }],
      },
      texture: { description: 'Stone and smoke.', observations: [] },
      camera: {
        description: 'Measured movement.',
        movement: [{ name: 'Slow push', description: 'Move only as decisions harden.' }],
        motion: [{ name: 'Held weight', description: 'Let labor remain deliberate.' }],
        framing: [{ name: 'Human scale', description: 'Keep bodies small against masonry.' }],
      },
    },
    sourceInspirationFolderIds: [],
  };
}
