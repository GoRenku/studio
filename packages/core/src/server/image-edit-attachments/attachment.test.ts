import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AssetFileOwner, ProjectRelativePath } from '../../client/index.js';
import { createDeterministicIdGenerator } from '../entity-ids.js';
import { createProjectDataService } from '../project-data-service.js';
import { createTestAssetFileFixture } from '../testing/asset-fixture-helpers.js';
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
      const source = await createTestAssetFileFixture({
        projectName: 'constantinople',
        homeDir,
        owner: owner as AssetFileOwner,
        type,
        mediaKind: 'image',
        title: 'Source title',
        oneLineSummary: 'Source summary',
        projectRelativePath: sourcePath,
        referenceName: 'continuity',
        tags: ['source-tag'],
      });

      const report = await projectData.attachGenerationMedia({
        projectName: 'constantinople',
        homeDir,
        purpose: 'image.edit',
        target: { kind: 'assetFile', assetFileId: source.id },
        sourceProjectRelativePath: outputPath,
        generationProvenance: provenance(sourcePath),
      });

      expect(report.assetFile.id).not.toBe(source.id);
      expect(report.assetFile).toMatchObject({
        owner,
        type,
        title: 'Source title',
        oneLineSummary: 'Source summary',
        referenceName: 'continuity',
        tags: ['source-tag'],
      });
      expect(report.assetFile?.projectRelativePath).toMatch(
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
    const source = await createTestAssetFileFixture({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'location', id: 'location_test0001' },
      type: 'location_sheet',
      mediaKind: 'image',
      title: 'Source',
      projectRelativePath: sourcePath,
    });

    await expect(projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'image.edit',
      target: { kind: 'assetFile', assetFileId: source.id },
      sourceProjectRelativePath: outputPath,
      generationProvenance: provenance('tmp/another.png' as ProjectRelativePath),
    })).rejects.toMatchObject({ code: 'CORE_IMAGE_EDIT_SOURCE_REFERENCE_MISSING' });
    await expect(fs.readdir(path.join(projectFolder, 'locations/council-chamber')))
      .rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.each(['inspiration', 'research'] as const)(
    'keeps edited %s images beside their source and allows deleting the original independently',
    async (kind) => {
      const input = { projectName: 'constantinople', homeDir };
      const folder = (await projectData.createInspirationFolder({ ...input, name: 'Reference room' })).folder;
      const sourcePath = kind === 'research'
        ? 'research/architecture/source.png' as ProjectRelativePath
        : `${folder.projectRelativePath}/source.png` as ProjectRelativePath;
      await writeImage(sourcePath);
      const imported = await projectData.importReferenceFiles({
        ...input,
        destination: kind === 'research' ? { kind } : { kind, folderId: folder.id },
        files: [{ sourceProjectRelativePath: sourcePath }],
      });
      const source = imported.assetFiles[0]!;
      const target = { kind: 'assetFile' as const, assetFileId: source.id };
      const context = await projectData.readMediaGenerationContext({ ...input, purpose: 'image.edit', target });
      expect(context.suggestedReferences[0]?.candidates[0]?.assetFileId).toBe(source.id);
      const outputPath = 'tmp/edited.png' as ProjectRelativePath;
      await writeImage(outputPath);
      await fs.writeFile(path.join(projectFolder, outputPath), 'edited image');
      const edited = await projectData.attachGenerationMedia({
        ...input, purpose: 'image.edit', target, sourceProjectRelativePath: outputPath,
        generationProvenance: provenance(sourcePath),
      });
      expect(edited.assetFile.id).not.toBe(source.id);
      expect(edited.assetFile).toMatchObject({ owner: source.owner, type: source.type, title: null });
      expect(path.posix.dirname(edited.assetFile.projectRelativePath)).toBe(path.posix.dirname(sourcePath));
      expect(await fs.readFile(path.join(projectFolder, sourcePath), 'utf8')).toBe('image');
      const page = await projectData.listAssetFilePage({ ...input, owner: source.owner, type: source.type });
      expect(page.items.map((file) => file.id)).toEqual(expect.arrayContaining([source.id, edited.assetFile.id]));
      expect(page.selectedAssetFileId).toBeNull();
      if (kind === 'inspiration') {
        const resource = await projectData.readInspirationFolder({ ...input, folderId: folder.id });
        expect(resource.images.map((file) => file.id)).toEqual(expect.arrayContaining([source.id, edited.assetFile.id]));
        expect(edited.resourceKeys).toContain(`surface:visual-language:inspiration:${folder.id}`);
      }
      await projectData.discardAssetFile({ ...input, owner: source.owner, assetFileId: source.id });
      const preview = await projectData.previewGarbageCollection(input);
      await projectData.emptyTrash({ ...input, confirmationToken: preview.confirmationToken });
      const retained = await projectData.resolveProjectAssetFileById({ ...input, assetFileId: edited.assetFile.id });
      expect(await fs.readFile(retained.absolutePath, 'utf8')).toBe('edited image');
    },
  );

  it.each([
    { kind: 'project' },
    { kind: 'castMember', id: 'cast_test0002' },
  ] as const)('edits arbitrary image types for $kind without changing the source metadata', async (owner) => {
    const input = { projectName: 'constantinople', homeDir };
    const sourcePath = 'media/unclassified/source.png' as ProjectRelativePath;
    const outputPath = 'tmp/unclassified-output.png' as ProjectRelativePath;
    await writeImage(sourcePath);
    await writeImage(outputPath);
    const source = await createTestAssetFileFixture({
      ...input, owner, type: 'unclassified_image', mediaKind: 'image', title: 'Source',
      projectRelativePath: sourcePath, locale: { localeId: 'locale_test0001' },
      oneLineSummary: 'Source summary', referenceName: 'reference', tags: ['continuity'],
    });
    const edited = await projectData.attachGenerationMedia({
      ...input, purpose: 'image.edit', target: { kind: 'assetFile', assetFileId: source.id },
      sourceProjectRelativePath: outputPath, generationProvenance: provenance(sourcePath),
    });
    expect(edited.assetFile).toMatchObject({
      owner, type: source.type, localeId: source.localeId, title: source.title,
      oneLineSummary: source.oneLineSummary, referenceName: source.referenceName, tags: source.tags,
    });
    expect(edited.assetFile.projectRelativePath).toMatch(/^media\/unclassified\/edited-image-g[a-z0-9]+\.png$/);
    const files = await projectData.listAssetFiles({ ...input, owner });
    expect(files.find((file) => file.id === source.id)).toEqual(source);
  });

  it.each([
    ['character_sheet', { kind: 'project' }, 'CORE_IMAGE_EDIT_OWNER_INVALID'],
    ['lookbook_image', { kind: 'project' }, 'CORE_IMAGE_EDIT_OWNER_INVALID'],
    ['shot_image', { kind: 'project' }, 'CORE_IMAGE_EDIT_OWNER_INVALID'],
    ['scene_storyboard_image', { kind: 'project' }, 'CORE_IMAGE_EDIT_SURFACE_UNAVAILABLE'],
    ['shot_plan_video_first_frame', { kind: 'castMember', id: 'cast_test0002' }, 'CORE_IMAGE_EDIT_OWNER_INVALID'],
  ] as const)(
    'rejects invalid %s continuation before adding another Asset',
    async (type, owner, code) => {
      const sourcePath = `tmp/source-${type}.png` as ProjectRelativePath;
      const outputPath = `tmp/output-${type}.png` as ProjectRelativePath;
      await writeImage(sourcePath);
      await writeImage(outputPath);
      const source = await createTestAssetFileFixture({
        projectName: 'constantinople',
        homeDir,
        owner: owner as AssetFileOwner,
        type,
        mediaKind: 'image',
        title: 'Invalid continuation source',
        projectRelativePath: sourcePath,
      });
      const before = await projectData.listAssetFiles({
        projectName: 'constantinople', homeDir, owner: owner as AssetFileOwner,
      });

      await expect(projectData.attachGenerationMedia({
        projectName: 'constantinople',
        homeDir,
        purpose: 'image.edit',
        target: { kind: 'assetFile', assetFileId: source.id },
        sourceProjectRelativePath: outputPath,
        generationProvenance: provenance(sourcePath),
      })).rejects.toMatchObject({ code });

      const after = await projectData.listAssetFiles({
        projectName: 'constantinople', homeDir, owner: owner as AssetFileOwner,
      });
      expect(after.map((assetFile) => assetFile.id)).toEqual(before.map((assetFile) => assetFile.id));
    },
  );

  it('keeps image.create and all four edited Plan image roles beside the exact Shot Plan', async () => {
    const screenplay = await projectData.readScreenplayStructure({
      projectName: 'constantinople',
      homeDir,
    });
    const plan = await projectData.createShotPlan({
      type: 'shot-list',
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
    expect(created.assetFile).toMatchObject({
      owner: { kind: 'project' },
      type: 'shot_plan_video_reference',
      authoredFrom: { kind: 'shotPlan', id: plan.shotPlan.id },
    });
    expect(created.assetFile?.projectRelativePath).toMatch(
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
        target: { kind: 'assetFile', assetFileId: source.assetFile.id },
        sourceProjectRelativePath: editedPath,
        generationProvenance: provenance(source.assetFile!.projectRelativePath),
      });
      expect(edited.assetFile).toMatchObject({
        owner: { kind: 'project' },
        type,
        authoredFrom: { kind: 'shotPlan', id: plan.shotPlan.id },
      });
      expect(edited.assetFile?.projectRelativePath).toMatch(
        new RegExp(`/01-shot-plan/${stem}-g[a-z0-9]+\\.png$`),
      );
    }

    const projection = await projectData.readShotPlanAssetFiles({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
    });
    expect(projection.groups.map((group) => group.role)).toEqual([
      'first-frame', 'last-frame', 'storyboard', 'reference',
    ]);
    expect(projection.groups.find((group) => group.role === 'reference')?.assetFiles)
      .toHaveLength(3);
    const otherPlan = await projectData.createShotPlan({
      type: 'shot-list',
      projectName: 'constantinople',
      homeDir,
      sceneId: screenplay.screenplay.scenes[0]!.id,
      title: 'Other plan',
      coverage: null,
      shots: [],
    });
    await expect(projectData.discardShotPlanAssetFile({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: otherPlan.shotPlan.id,
      assetFileId: created.assetFile.id,
    })).rejects.toMatchObject({ code: 'CORE_SHOT_PLAN_ASSETS_NOT_FOUND' });
    await projectData.discardShotPlanAssetFile({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
      assetFileId: created.assetFile.id,
    });
    const afterDiscard = await projectData.readShotPlanAssetFiles({
      projectName: 'constantinople', homeDir, shotPlanId: plan.shotPlan.id,
    });
    expect(afterDiscard.groups.find((group) => group.role === 'reference')?.assetFiles)
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
        assetFileMetadata: { referenceName: 'continuity' },
      });
      const edited = await projectData.attachGenerationMedia({
        projectName: 'constantinople',
        homeDir,
        purpose: 'image.edit',
        target: { kind: 'assetFile', assetFileId: source.assetFile.id },
        sourceProjectRelativePath: editedPath,
        generationProvenance: provenance(source.assetFile!.projectRelativePath),
      });
      expect(edited.ownerRecord).toMatchObject({
        kind: type === 'lookbook_image' ? 'lookbookImage' : 'lookbookSheet',
      });
      expect(edited.assetFile).toMatchObject({
        owner: { kind: 'lookbook', id: lookbook.lookbook.id },
        type,
      });
      expect(edited.assetFile?.projectRelativePath).toMatch(
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
      target: { kind: 'assetFile', assetFileId: beatSource.id },
      sourceProjectRelativePath: beatEditedPath,
      generationProvenance: provenance(beatSource!.projectRelativePath),
    });
    const storyboardStatus = await projectData.readSceneStoryboardStatus({
      projectName: 'constantinople',
      homeDir,
      sceneId: scene.id,
      sceneBeatsRevisionId: revision.activeRevisionId,
    });
    expect(storyboardStatus.beats[0]).toMatchObject({ selectedImageId: beatSource.id });
    expect(storyboardStatus.beats[0]?.images.map((assetFile) => assetFile.id))
      .toContain(beatEdited.assetFile.id);
    await expect(projectData.selectSceneStoryboardImageCandidate({
      projectName: 'constantinople',
      homeDir,
      sceneId: scene.id,
      sceneBeatsRevisionId: 'scene_beats_revision_missing',
      beatId: 'beat_test0001',
      assetFileId: beatEdited.assetFile.id,
    })).rejects.toMatchObject({ code: 'CORE_SCENE_STORYBOARD_CANDIDATE_CONTEXT_INVALID' });
    const selectionReport = await projectData.selectSceneStoryboardImageCandidate({
      projectName: 'constantinople',
      homeDir,
      sceneId: scene.id,
      sceneBeatsRevisionId: revision.activeRevisionId,
      beatId: 'beat_test0001',
      assetFileId: beatEdited.assetFile.id,
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
      assetFileId: beatSource.id,
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
      selectedImageId: beatEdited.assetFile.id,
      images: [expect.objectContaining({ id: beatEdited.assetFile.id })],
    });

    const plan = await projectData.createShotPlan({
      type: 'shot-list',
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
      target: { kind: 'assetFile', assetFileId: shotSource.assetFile.id },
      sourceProjectRelativePath: shotEditedPath,
      generationProvenance: provenance(shotSource.assetFile!.projectRelativePath),
    });
    const currentPlan = await projectData.readShotPlan({
      projectName: 'constantinople', homeDir, shotPlanId: plan.shotPlan.id,
    });
    expect(currentPlan.shotPlan.shots[0]?.selectedImageId).toBe(shotSource.assetFile.id);
    expect(currentPlan.shotPlan.shots[0]?.images.map((assetFile) => assetFile.id))
      .toContain(shotEdited.assetFile.id);
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
