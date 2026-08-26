import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MediaPurpose, ProjectRelativePath } from '../../client/index.js';
import { createDeterministicIdGenerator } from '../entity-ids.js';
import { createProjectDataService } from '../project-data-service.js';
import { createTestAssetFixture } from '../testing/asset-fixture-helpers.js';
import { createDialogueAudioReadyProject } from '../testing/dialogue-audio-template-fixtures.js';
import { createSampleMovieProject, writeConfig } from '../testing/project-data-fixtures.js';
import { mediaGenerationOutputGuidance } from './purpose-registry.js';

describe('media generation context', () => {
  let homeDir: string;
  let projectData = createProjectDataService();

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-media-context-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    projectData = createProjectDataService();
  });

  it('projects current same-owner evidence without selecting or excluding creative alternatives', async () => {
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const castPath = 'tmp/mehmed-sheet.png' as ProjectRelativePath;
    const locationPath = 'tmp/chamber-sheet.png' as ProjectRelativePath;
    await fs.mkdir(path.join(created.projectPath, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(created.projectPath, castPath), 'cast');
    await fs.writeFile(path.join(created.projectPath, locationPath), 'location');
    const castAsset = await createTestAssetFixture({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'castMember', id: 'cast_test0002' },
      type: 'character_sheet',
      mediaKind: 'image',
      title: 'Mehmed continuity',
      projectRelativePath: castPath,
      fileRole: 'primary',
    });
    const unrelatedAsset = await createTestAssetFixture({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'location', id: 'location_test0001' },
      type: 'location_sheet',
      mediaKind: 'image',
      title: 'Council chamber continuity',
      projectRelativePath: locationPath,
      fileRole: 'primary',
    });

    const report = await projectData.readMediaGenerationContext({
      homeDir,
      purpose: 'cast.profile',
      target: { kind: 'castMember', id: 'cast_test0002' },
    });
    const continuity = report.suggestedReferences.find((group) => group.id === 'cast-continuity');

    expect(report.targetContext).toMatchObject({
      kind: 'castMember',
      castMember: { id: 'cast_test0002', name: 'Mehmed II' },
    });
    expect(continuity?.candidates).toEqual([
      expect.objectContaining({
        assetId: castAsset.id,
        owner: { kind: 'castMember', id: 'cast_test0002' },
        available: true,
        isDisplaySelected: false,
      }),
    ]);
    expect(continuity?.candidates.map((candidate) => candidate.assetId)).not.toContain(unrelatedAsset.id);
    expect(report).not.toHaveProperty('provider');
    expect(report).not.toHaveProperty('model');
    expect(report).not.toHaveProperty('request');
    expect(continuity).not.toHaveProperty('selectedCandidateId');
  });

  it('resolves an exact Scene Beats revision and returns requested Beats in canonical order', async () => {
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const screenplay = await projectData.readScreenplayStructure({
      projectName: 'constantinople',
      homeDir,
    });
    const scene = screenplay.screenplay.scenes[0]!;
    const blockId = scene.blocks[0]!.id;
    const revision = await projectData.createSceneBeatsRevision({
      homeDir,
      idGenerator: createDeterministicIdGenerator(),
      document: {
        sceneId: scene.id,
        beats: [
          beat('Opening', blockId),
          beat('Decision', blockId),
          beat('Aftermath', blockId),
        ],
      },
    });

    const report = await projectData.readMediaGenerationContext({
      homeDir,
      purpose: 'scene.storyboard-sheet',
      target: { kind: 'scene', id: scene.id },
      sceneStoryboardScope: {
        sceneBeatsRevisionId: revision.activeRevisionId,
        beatIds: ['beat_test0003', 'beat_test0001'],
      },
    });

    expect(report.targetContext).toMatchObject({
      kind: 'scene',
      selectedBeatIds: ['beat_test0001', 'beat_test0003'],
    });
    if (report.targetContext.kind !== 'scene') {
      throw new Error('Expected Scene context.');
    }
    expect(report.targetContext.castMembers).toEqual(expect.arrayContaining([
      expect.objectContaining({ castMember: expect.objectContaining({ id: 'cast_test0002' }) }),
    ]));
    expect(report.targetContext.locations).toEqual(expect.arrayContaining([
      expect.objectContaining({ location: expect.objectContaining({ id: 'location_test0001' }) }),
    ]));
    expect(report.suggestedReferences.filter((group) => group.id === 'beat-storyboard'))
      .toHaveLength(2);
  });

  it('fails only for invalid identity or exact scope while reporting missing creative context', async () => {
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const screenplay = await projectData.readScreenplayStructure({
      projectName: 'constantinople',
      homeDir,
    });
    const sceneId = screenplay.screenplay.scenes[0]!.id;

    await expect(projectData.readMediaGenerationContext({
      homeDir,
      purpose: 'cast.profile',
      target: { kind: 'location', id: 'location_test0001' },
    })).rejects.toMatchObject({ code: 'CORE_GENERATION_TARGET_INVALID' });
    await expect(projectData.readMediaGenerationContext({
      homeDir,
      purpose: 'project.cover',
      target: { kind: 'project', id: 'not-project' },
    })).rejects.toMatchObject({ code: 'CORE_GENERATION_TARGET_INVALID' });
    await expect(projectData.readMediaGenerationContext({
      homeDir,
      purpose: 'project.cover',
      target: { kind: 'project', id: 'project' },
      sceneStoryboardScope: { beatIds: [] },
    })).rejects.toMatchObject({ code: 'CORE_MEDIA_GENERATION_CONTEXT_SCOPE_INVALID' });
    await expect(projectData.readMediaGenerationContext({
      homeDir,
      purpose: 'scene.storyboard-sheet',
      target: { kind: 'scene', id: sceneId },
      sceneStoryboardScope: { sceneBeatsRevisionId: 'scene_beats_revision_missing', beatIds: [] },
    })).rejects.toMatchObject({ code: 'CORE_MEDIA_GENERATION_CONTEXT_SCOPE_INVALID' });
    await expect(projectData.readMediaGenerationContext({
      homeDir,
      purpose: 'scene.storyboard-sheet',
      target: { kind: 'scene', id: sceneId },
      sceneStoryboardScope: { beatIds: ['beat_missing'] },
    })).rejects.toMatchObject({ code: 'CORE_MEDIA_GENERATION_CONTEXT_SCOPE_INVALID' });

    const report = await projectData.readMediaGenerationContext({
      homeDir,
      purpose: 'scene.storyboard-sheet',
      target: { kind: 'scene', id: sceneId },
    });
    expect(report.valid).toBe(true);
    expect(report.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CORE_MEDIA_GENERATION_CONTEXT_GAP' }),
    ]));
  });

  it('keeps Shot and Shot Plan evidence scoped to the exact owning plan', async () => {
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const screenplay = await projectData.readScreenplayStructure({
      projectName: 'constantinople',
      homeDir,
    });
    const sceneId = screenplay.screenplay.scenes[0]!.id;
    const plan = await projectData.createShotPlan({
      projectName: 'constantinople',
      homeDir,
      sceneId,
      title: 'Primary plan',
      coverage: null,
      shots: [
        { title: 'Wide', description: 'Wide.', brief: {} },
        { title: 'Close', description: 'Close.', brief: {} },
      ],
    });
    const otherPlan = await projectData.createShotPlan({
      projectName: 'constantinople',
      homeDir,
      sceneId,
      title: 'Other plan',
      coverage: null,
      shots: [],
    });
    await fs.mkdir(path.join(created.projectPath, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(created.projectPath, 'tmp', 'first.png'), 'first');
    await fs.writeFile(path.join(created.projectPath, 'tmp', 'other.png'), 'other');
    await fs.writeFile(path.join(created.projectPath, 'tmp', 'shot.png'), 'shot');
    const provenance = {
      provider: 'fal-ai',
      model: 'provider/model',
      mediaKind: 'image' as const,
      prompt: 'Exact authored prompt.',
      request: { prompt: 'Exact authored prompt.' },
    };
    const firstFrame = await projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'shot-plan.video-first-frame',
      target: { kind: 'shotPlan', id: plan.shotPlan.id },
      sourceProjectRelativePath: 'tmp/first.png',
      generationProvenance: provenance,
    });
    const otherFrame = await projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'shot-plan.video-first-frame',
      target: { kind: 'shotPlan', id: otherPlan.shotPlan.id },
      sourceProjectRelativePath: 'tmp/other.png',
      generationProvenance: provenance,
    });
    const selectedShotImage = await projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'shot.image',
      target: { kind: 'shot', id: plan.shotPlan.shots[0]!.id },
      sourceProjectRelativePath: 'tmp/shot.png',
      select: true,
    });

    const lastFrameContext = await projectData.readMediaGenerationContext({
      homeDir,
      purpose: 'shot-plan.video-last-frame',
      target: { kind: 'shotPlan', id: plan.shotPlan.id },
    });
    const firstFrameGroup = lastFrameContext.suggestedReferences
      .find((group) => group.role === 'first-frame');
    expect(firstFrameGroup?.candidates.map((candidate) => candidate.assetId))
      .toEqual([firstFrame.asset.id]);
    expect(firstFrameGroup?.candidates.map((candidate) => candidate.assetId))
      .not.toContain(otherFrame.asset.id);

    const shotContext = await projectData.readMediaGenerationContext({
      homeDir,
      purpose: 'shot.image',
      target: { kind: 'shot', id: plan.shotPlan.shots[1]!.id },
    });
    expect(shotContext.targetContext).toMatchObject({
      kind: 'shot',
      shotPlan: { id: plan.shotPlan.id },
      sceneContext: { scene: { id: sceneId } },
    });
    expect(shotContext.suggestedReferences
      .find((group) => group.role === 'shot-image')?.candidates)
      .toEqual([expect.objectContaining({
        assetId: selectedShotImage.asset.id,
        isDisplaySelected: true,
      })]);

    for (const purpose of [
      'shot-plan.video-generation',
      'shot-plan.video-first-frame',
      'shot-plan.video-last-frame',
      'shot-plan.video-storyboard',
      'shot-plan.video-reference',
    ] as const) {
      await expect(projectData.readMediaGenerationContext({
        homeDir,
        purpose,
        target: { kind: 'shotPlan', id: plan.shotPlan.id },
      })).resolves.toMatchObject({ purpose, targetContext: { kind: 'shotPlan' } });
    }
  });

  it('projects every non-Shot target family through the shared contract', async () => {
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    await projectData.applyPropOperations({
      homeDir,
      document: {
        kind: 'propOperations',
        operations: [{
          operation: 'prop.add',
          prop: { key: 'map', handle: 'map', name: 'Siege map' },
        }],
      },
      idGenerator: createDeterministicIdGenerator(),
    });
    const production = await projectData.writeProductionLookbook({
      homeDir,
      document: productionLookbookDocument(),
    });
    const storyboard = await projectData.writeStoryboardLookbook({
      homeDir,
      document: storyboardLookbookDocument(),
    });
    await fs.mkdir(path.join(created.projectPath, 'tmp'), { recursive: true });
    const sourcePath = 'tmp/source.png' as ProjectRelativePath;
    await fs.writeFile(path.join(created.projectPath, sourcePath), 'source');
    const sourceAsset = await createTestAssetFixture({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'castMember', id: 'cast_test0002' },
      type: 'profile_image',
      mediaKind: 'image',
      title: 'Source portrait',
      projectRelativePath: sourcePath,
      fileRole: 'primary',
    });
    const screenplay = await projectData.readScreenplayStructure({
      projectName: 'constantinople',
      homeDir,
    });
    const imageCreateShotPlan = await projectData.createShotPlan({
      homeDir,
      sceneId: screenplay.screenplay.scenes[0]!.id,
      title: 'Image Create references',
      coverage: null,
      shots: [],
    });
    const cases = [
      ['image.create', { kind: 'shotPlan', id: imageCreateShotPlan.shotPlan.id }, 'shotPlan'],
      ['image.edit', { kind: 'asset', id: sourceAsset.id }, 'asset'],
      ['project.cover', { kind: 'project', id: 'project' }, 'project'],
      ['lookbook.image', { kind: 'lookbook', id: production.lookbook.id }, 'lookbook'],
      ['lookbook.video-sheet', { kind: 'lookbook', id: production.lookbook.id }, 'lookbook'],
      ['lookbook.storyboard-sheet', { kind: 'lookbook', id: storyboard.lookbook.id }, 'lookbook'],
      ['cast.character-sheet', { kind: 'castMember', id: 'cast_test0002' }, 'castMember'],
      ['cast.profile', { kind: 'castMember', id: 'cast_test0002' }, 'castMember'],
      ['cast.voice-sample', { kind: 'castMember', id: 'cast_test0002' }, 'castMember'],
      ['location.sheet', { kind: 'location', id: 'location_test0001' }, 'location'],
      ['location.hero', { kind: 'location', id: 'location_test0001' }, 'location'],
      ['prop.sheet', { kind: 'prop', id: 'prop_test0001' }, 'prop'],
      ['prop.hero', { kind: 'prop', id: 'prop_test0001' }, 'prop'],
      ['scene.storyboard-sheet', { kind: 'scene', id: screenplay.screenplay.scenes[0]!.id }, 'scene'],
    ] as const;

    for (const [purpose, target, contextKind] of cases) {
      await expect(projectData.readMediaGenerationContext({
        homeDir,
        purpose,
        target,
      })).resolves.toMatchObject({
        valid: true,
        purpose,
        targetContext: { kind: contextKind },
      });
    }
  });

  it('projects exact dialogue, speaker, voice options, setup, and prior Takes', async () => {
    const ready = await createDialogueAudioReadyProject();
    if (!ready) {
      return;
    }

    const report = await ready.projectData.readMediaGenerationContext({
      homeDir: ready.homeDir,
      purpose: 'scene.dialogue-audio',
      target: {
        kind: 'sceneDialogue',
        sceneId: ready.sceneId,
        turnId: ready.dialogueId,
      },
    });

    expect(report.targetContext).toMatchObject({
      kind: 'sceneDialogue',
      scene: { id: ready.sceneId },
      turn: {
        turnId: ready.dialogueId,
        castMemberId: 'cast_test0001',
        plainText: 'Bronze has no temper. Men give it one.',
      },
      speaker: { id: 'cast_test0001', name: 'Urban' },
      priorTakes: [],
    });

    await expect(ready.projectData.readMediaGenerationContext({
      homeDir: ready.homeDir,
      purpose: 'scene.dialogue-audio',
      target: {
        kind: 'sceneDialogue',
        sceneId: 'scene_wrong',
        turnId: ready.dialogueId,
      },
    })).rejects.toMatchObject({
      code: 'CORE_MEDIA_GENERATION_CONTEXT_TARGET_NOT_FOUND',
    });
  });

  it('defines the complete purpose-level output guidance without provider fields', () => {
    const expected: Record<MediaPurpose, [string | null, 'medium' | 'high' | null]> = {
      'image.create': [null, null],
      'image.edit': [null, null],
      'project.cover': ['16:9', 'medium'],
      'shot-plan.video-generation': [null, null],
      'shot-plan.video-first-frame': [null, null],
      'shot-plan.video-last-frame': [null, null],
      'shot-plan.video-storyboard': [null, null],
      'shot-plan.video-reference': [null, null],
      'lookbook.image': ['2.39:1', 'medium'],
      'lookbook.video-sheet': ['4:3', 'high'],
      'lookbook.storyboard-sheet': ['4:3', 'high'],
      'cast.character-sheet': ['16:9', 'high'],
      'cast.profile': ['1:1', 'medium'],
      'cast.voice-sample': [null, null],
      'scene.dialogue-audio': [null, null],
      'location.sheet': ['16:9', 'high'],
      'location.hero': ['16:9', 'medium'],
      'prop.sheet': ['16:9', 'high'],
      'prop.hero': ['16:9', 'medium'],
      'scene.storyboard-sheet': [null, 'high'],
      'shot.image': ['2.39:1', 'high'],
    };

    expect(Object.fromEntries(Object.keys(expected).map((purpose) => {
      const guidance = mediaGenerationOutputGuidance(purpose as MediaPurpose, '2.39:1');
      return [purpose, [guidance.aspectRatio?.value ?? null, guidance.quality?.value ?? null]];
    }))).toEqual(expected);
  });
});

function beat(title: string, screenplayBlockId: string) {
  return {
    title,
    description: `${title} image description.`,
    narrativeDevelopment: `${title} advances the scene.`,
    narrativePurpose: `${title} has a clear purpose.`,
    screenplayBlockIds: [screenplayBlockId],
    castMemberIds: ['cast_test0002'],
    locationIds: ['location_test0001'],
    propIds: [],
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

function storyboardLookbookDocument() {
  return {
    kind: 'storyboardLookbook' as const,
    storyboardLookbook: {
      name: 'Storyboard Language',
      styleBrief: { text: 'Loose graphite frames.' },
      lineAndFinish: { text: 'Visible construction lines.' },
      valueAndAccent: { text: 'Gray wash with ochre accents.' },
      guardrails: { text: 'Avoid final-film polish.' },
    },
    sourceInspirationFolderIds: [],
  };
}
