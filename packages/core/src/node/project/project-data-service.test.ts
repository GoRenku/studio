import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
  type ProjectRelativePath,
} from './index.js';
import { validateNarrativeStarter } from './narrative-starter/index.js';
import { validateProjectSetup } from './setup/project-setup-reader.js';

describe('ProjectDataService', () => {
  let homeDir: string;
  let storageRoot: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-create-test-'));
    storageRoot = path.join(homeDir, 'projects');
    await writeConfig(homeDir, storageRoot);
  });

  it('creates a project-local SQLite database from ProjectSetup YAML', async () => {
    const setupPath = await writeProjectSetup(homeDir);
    const projectData = createProjectDataService();

    const result = await runCreateOrSkip(
      projectData.createFromSetup({
        setupPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    );
    if (!result) {
      return;
    }

    expect(result).toMatchObject({
      projectName: 'constantinople',
      projectPath: path.join(storageRoot, 'constantinople'),
      databasePath: path.join(storageRoot, 'constantinople', '.renku', 'project.sqlite'),
      coverPath: null,
      created: {
        languages: 2,
        castMembers: 2,
        visualLanguageCategories: 2,
        visualLanguage: 1,
        continuityReferences: 1,
        episodes: 0,
        sequences: 1,
        scenes: 1,
        clips: 2,
      },
    });

    const project = await projectData.readProject({
      projectName: 'constantinople',
      homeDir,
    });
    expect(project.identity).toMatchObject({
      id: 'project_test0001',
      name: 'constantinople',
      title: 'Preparation of the Siege',
      type: 'standaloneMovie',
      summary: 'A documentary setup summary for Markdown storage.',
    });
    expect(project.identity.summaryAsset).toMatchObject({
      role: 'summary',
      projectRelativePath: 'working-assets/base/narrative/project-summary.md',
    });
    expect(project.identity).not.toHaveProperty('format');
    expect(project.identity).not.toHaveProperty('resolution');
    expect(project.languages).toEqual([
      expect.objectContaining({
        localeTag: 'en-US',
        isBase: true,
        supportsAudio: true,
        supportsSubtitles: true,
      }),
      expect.objectContaining({
        localeTag: 'tr-TR',
        isBase: false,
        supportsAudio: true,
        supportsSubtitles: true,
      }),
    ]);
    expect(project.cast.map((cast) => cast.id)).toEqual([
      'cast_test0001',
      'cast_test0002',
    ]);
    expect(project.visualLanguageCategories).toEqual([
      expect.objectContaining({
        id: 'visual_language_category_test0001',
        name: 'Lighting',
      }),
      expect.objectContaining({
        id: 'visual_language_category_test0002',
        name: 'Camera',
      }),
    ]);
    expect(project.visualLanguage[0]).toMatchObject({
      categoryId: 'visual_language_category_test0001',
      summary: 'Warm practical interiors.',
      priority: 'default',
      guidance: 'Formal staging and controlled historical detail.',
      prompt: 'Warm practical candlelight, deep brown shadows.',
      guidanceAsset: expect.objectContaining({
        role: 'guidance',
      }),
      promptAsset: expect.objectContaining({
        role: 'prompt',
      }),
    });
    expect(project.continuityReferences[0]).toMatchObject({
      id: 'continuity_reference_test0001',
      kind: 'location',
      name: "Mehmed's council chamber",
      description: 'Formal Ottoman planning room with maps and oil lamps.',
      descriptionAsset: expect.objectContaining({
        role: 'description',
      }),
    });
    expect(project.sequences[0]?.scenes[0]?.clips).toHaveLength(2);
    expect(project.sequences[0]).toMatchObject({
      summary: 'Mehmed turns conquest into policy.',
      summaryAsset: expect.objectContaining({
        role: 'summary',
      }),
    });
    expect(project.sequences[0]?.scenes[0]?.clips[0]).toMatchObject({
      summary: 'Mehmed is introduced as controlled and ambitious.',
      visualIntent: 'Quiet court staging.',
      summaryAsset: expect.objectContaining({ role: 'summary' }),
      visualIntentAsset: expect.objectContaining({ role: 'visual_intent' }),
    });

    await expect(
      fs.readFile(
        path.join(
          result.projectPath,
          'working-assets',
          'base',
          'narrative',
          'project-summary.md'
        ),
        'utf8'
      )
    ).resolves.toBe('A documentary setup summary for Markdown storage.\n');
    await expect(
      fs.access(path.join(result.projectPath, 'working-assets', 'base', 'cast'))
    ).resolves.toBeUndefined();
    await expect(
      fs.access(
        path.join(
          result.projectPath,
          'working-assets',
          'base',
          'cast',
          '01-narrator'
        )
      )
    ).resolves.toBeUndefined();
    await expect(
      fs.access(
        path.join(
          result.projectPath,
          'working-assets',
          'base',
          'cast',
          '02-mehmed-ii'
        )
      )
    ).resolves.toBeUndefined();

    const database = new Database(result.databasePath, { readonly: true });
    try {
      const tables = database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all()
        .map((row) => (row as { name: string }).name);
      expect(tables).toEqual(
        expect.arrayContaining([
          'asset',
          'asset_file',
          'project_asset',
          'project_locale',
          'visual_language_category',
          'continuity_reference',
          'continuity_reference_asset',
          'visual_language_asset',
          'sequence_asset',
          'scene_asset',
          'clip_asset',
        ])
      );
      expect(tables).not.toContain('project_language');
      expect(tableColumns(database, 'project')).not.toContain('summary');
      expect(tableColumns(database, 'visual_language')).not.toContain('intent');
      expect(tableColumns(database, 'visual_language')).not.toContain('prompt');
      expect(tableColumns(database, 'clip')).not.toContain('visual_intent');

      const projectSummary = database
        .prepare(
          `SELECT af.project_relative_path
           FROM project_asset pa
           JOIN asset_file af ON af.asset_id = pa.asset_id
           WHERE pa.role = 'summary'`
        )
        .get() as { project_relative_path: string } | undefined;
      expect(projectSummary?.project_relative_path).toBe(
        'working-assets/base/narrative/project-summary.md'
      );
    } finally {
      database.close();
    }
  });

  it('preserves setup episode summaries', async () => {
    const setupPath = await writeEpisodeProjectSetup(homeDir);
    const projectData = createProjectDataService();

    const result = await runCreateOrSkip(
      projectData.createFromSetup({
        setupPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    );
    if (!result) {
      return;
    }

    const project = await projectData.readProject({
      projectName: 'constantinople-series',
      homeDir,
    });

    expect(project.episodes[0]).toMatchObject({
      title: 'The First Preparations',
      summary: 'Mehmed turns an inherited ambition into a concrete plan.',
    });
  });

  it('creates a project from narrative starter YAML with Markdown references', async () => {
    const starterPath = await writeNarrativeStarter(homeDir);
    const projectData = createProjectDataService();

    const result = await runCreateOrSkip(
      projectData.createFromNarrativeStarter({
        starterPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    );
    if (!result) {
      return;
    }

    expect(result).toMatchObject({
      projectName: 'constantinople',
      projectPath: path.join(storageRoot, 'constantinople'),
      coverPath: path.join(storageRoot, 'constantinople', 'cover.png'),
      created: {
        languages: 1,
        castMembers: 2,
        visualLanguageCategories: 2,
        visualLanguage: 1,
        continuityReferences: 1,
        episodes: 0,
        sequences: 1,
        scenes: 1,
        clips: 1,
      },
      warnings: [],
    });
    await expect(fs.readFile(result.coverPath!, 'utf8')).resolves.toBe(
      'narrative cover'
    );

    const project = await projectData.readProject({
      projectName: 'constantinople',
      homeDir,
    });
    expect(project.identity).toMatchObject({
      name: 'constantinople',
      title: 'Preparation of the Siege',
      type: 'standaloneMovie',
      aspectRatio: '16:9',
      logline: 'A documentary about preparation before 1453.',
      summary: 'Project summary from Markdown.',
    });
    expect(project.cast).toEqual([
      expect.objectContaining({
        name: 'Narrator',
        kind: 'narrator',
        role: 'Voiceover',
      }),
      expect.objectContaining({
        name: 'Mehmed II',
        kind: 'historical_figure',
        role: 'Protagonist',
        shortDescription: 'Young Ottoman sultan.',
      }),
    ]);
    expect(project.visualLanguageCategories).toEqual([
      expect.objectContaining({
        name: 'Lighting',
        description: 'Light behavior and source logic.',
      }),
      expect.objectContaining({
        name: 'Camera',
        description: 'Camera placement and motion.',
      }),
    ]);
    expect(project.visualLanguage[0]).toMatchObject({
      name: 'Practical-source low-key interiors',
      summary: 'Warm practical interiors.',
      priority: 'default',
      guidance: 'Lighting guidance from Markdown.',
      prompt: 'Lighting prompt from Markdown.',
      guidanceAsset: expect.objectContaining({ role: 'guidance' }),
      promptAsset: expect.objectContaining({ role: 'prompt' }),
    });
    expect(project.continuityReferences[0]).toMatchObject({
      kind: 'location',
      name: "Mehmed's council chamber",
      summary: 'Formal Ottoman planning room.',
      description: 'Continuity description from Markdown.',
      descriptionAsset: expect.objectContaining({ role: 'description' }),
    });
    expect(project.identity.summaryAsset).toMatchObject({
      role: 'summary',
      projectRelativePath: 'working-assets/base/narrative/project-summary.md',
    });
    expect(project.sequences[0]).toMatchObject({
      title: "The Young Sultan's Obsession",
      shortTitle: 'Ambition',
      summary: 'Mehmed turns conquest into policy.',
    });
    expect(project.sequences[0]?.scenes[0]?.clips[0]).toMatchObject({
      title: 'The New Sultan',
      summary: 'Clip summary from Markdown.',
      visualIntent: 'Quiet court staging from Markdown.',
    });

    await expect(
      fs.readFile(
        path.join(
          result.projectPath,
          'working-assets',
          'base',
          'sequences',
          '01-the-young-sultan-s-obsession',
          'scenes',
          '01-a-throne-facing-an-ancient-city',
          'clips',
          '01-the-new-sultan',
          'visual-intent.md'
        ),
        'utf8'
      )
    ).resolves.toBe('Quiet court staging from Markdown.\n');
  });

  it('requires narrative starter project name in YAML', async () => {
    const starterPath = await writeNarrativeStarter(homeDir, {
      projectNameLine: '',
    });
    const projectData = createProjectDataService();

    await expect(
      projectData.createFromNarrativeStarter({
        starterPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    ).rejects.toMatchObject({
      code: 'NARRATIVE_STARTER999',
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: 'NARRATIVE_STARTER010',
          message: 'project.name is required.',
        }),
      ]),
    });
    await expect(
      fs.stat(path.join(storageRoot, 'constantinople', '.renku', 'project.sqlite'))
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('registers, lists, selects, and reopens an attached asset', async () => {
    const setupPath = await writeProjectSetup(homeDir);
    const projectData = createProjectDataService();
    const created = await runCreateOrSkip(
      projectData.createFromSetup({
        setupPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    );
    if (!created) {
      return;
    }

    const assetPath =
      'working-assets/base/sequences/01-logistics/scenes/01-foundry/clips/001/narration.wav';
    await fs.mkdir(path.dirname(path.join(created.projectPath, assetPath)), {
      recursive: true,
    });
    await fs.writeFile(path.join(created.projectPath, assetPath), 'audio bytes');

    const registered = await projectData.registerAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'clip', clipId: 'clip_test0001' },
      type: 'narration',
      mediaKind: 'audio',
      title: 'Narration take 1',
      projectRelativePath: assetPath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'narration',
    });

    expect(registered).toMatchObject({
      type: 'narration',
      availability: 'ready',
      role: 'narration',
      selection: { kind: 'take' },
      files: [expect.objectContaining({ projectRelativePath: assetPath })],
    });

    await expect(
      projectData.listAssets({
        projectName: 'constantinople',
        homeDir,
        target: { kind: 'clip', clipId: 'clip_test0001' },
      })
    ).resolves.toHaveLength(3);

    const selected = await projectData.createAssetSelect({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'clip', clipId: 'clip_test0001' },
      assetId: registered.assetId,
    });
    expect(selected.selection).toEqual({ kind: 'select', order: 1 });

    await expect(
      projectData.listAssetSelects({
        projectName: 'constantinople',
        homeDir,
        target: { kind: 'clip', clipId: 'clip_test0001' },
      })
    ).resolves.toEqual([expect.objectContaining({ assetId: registered.assetId })]);

    await expect(
      createProjectDataService().listAssetSelects({
        projectName: 'constantinople',
        homeDir,
        target: { kind: 'clip', clipId: 'clip_test0001' },
      })
    ).resolves.toEqual([
      expect.objectContaining({
        assetId: registered.assetId,
        selection: { kind: 'select', order: 1 },
      }),
    ]);
  });

  it('applies project database migrations by project name', async () => {
    const setupPath = await writeProjectSetup(homeDir);
    const projectData = createProjectDataService();

    const created = await runCreateOrSkip(
      projectData.createFromSetup({
        setupPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    );
    if (!created) {
      return;
    }

    const report = await projectData.migrateProjectDatabase({
      projectName: 'constantinople',
      homeDir,
    });

    expect(report).toEqual({
      projectName: 'constantinople',
      projectPath: path.join(storageRoot, 'constantinople'),
      databasePath: path.join(storageRoot, 'constantinople', '.renku', 'project.sqlite'),
    });

    const sqlite = new Database(report.databasePath);
    try {
      expect(sqlite.pragma('user_version', { simple: true })).toBe(1);
    } finally {
      sqlite.close();
    }
  });

  it('reads project text fields when visual language has image reference assets', async () => {
    const setupPath = await writeProjectSetup(homeDir);
    const projectData = createProjectDataService();
    const created = await runCreateOrSkip(
      projectData.createFromSetup({
        setupPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    );
    if (!created) {
      return;
    }

    const assetPath =
      'working-assets/base/visual-language/lighting/01-practical-source-low-key-interiors/reference.png';
    await fs.mkdir(path.dirname(path.join(created.projectPath, assetPath)), {
      recursive: true,
    });
    await fs.writeFile(path.join(created.projectPath, assetPath), 'image bytes');

    await projectData.registerAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'visualLanguage', visualLanguageId: 'visual_language_test0001' },
      type: 'image',
      mediaKind: 'image',
      title: 'Lighting reference',
      projectRelativePath: assetPath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'reference',
    });

    await expect(
      projectData.readProject({
        projectName: 'constantinople',
        homeDir,
      })
    ).resolves.toMatchObject({
      visualLanguage: [
        expect.objectContaining({
          id: 'visual_language_test0001',
          guidance: 'Formal staging and controlled historical detail.',
          prompt: 'Warm practical candlelight, deep brown shadows.',
        }),
      ],
    });
  });

  it('rejects image assets attached to visual language rich text roles', async () => {
    const setupPath = await writeProjectSetup(homeDir);
    const projectData = createProjectDataService();
    const created = await runCreateOrSkip(
      projectData.createFromSetup({
        setupPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    );
    if (!created) {
      return;
    }

    const assetPath =
      'working-assets/base/visual-language/lighting/01-practical-source-low-key-interiors/prompt.png';
    await fs.mkdir(path.dirname(path.join(created.projectPath, assetPath)), {
      recursive: true,
    });
    await fs.writeFile(path.join(created.projectPath, assetPath), 'image bytes');

    await projectData.registerAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'visualLanguage', visualLanguageId: 'visual_language_test0001' },
      type: 'image',
      mediaKind: 'image',
      title: 'Invalid prompt image',
      projectRelativePath: assetPath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'prompt',
    });

    await expect(
      projectData.readProject({
        projectName: 'constantinople',
        homeDir,
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA091',
      message: expect.stringContaining('rich text role prompt'),
    });
  });

  it('exports selected production assets incrementally and prunes stale files', async () => {
    const setupPath = await writeProjectSetup(homeDir);
    const projectData = createProjectDataService();
    const created = await runCreateOrSkip(
      projectData.createFromSetup({
        setupPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    );
    if (!created) {
      return;
    }

    const masterNarrationPath =
      'working-assets/base/sequences/01-logistics/scenes/01-foundry/clips/001/narration.wav';
    const sequenceVideoPath =
      'working-assets/base/sequences/01-logistics/sequence-video.mp4';
    const sceneTitleCardPath =
      'working-assets/base/sequences/01-logistics/scenes/01-foundry/title-card.png';
    const helperSheetPath = 'working-assets/base/cast/mehmed-sheet.png';
    const localizedSubtitlePath =
      'working-assets/localization/tr-TR/sequences/01-logistics/scenes/01-foundry/clips/001/subtitles.vtt';
    await fs.mkdir(path.dirname(path.join(created.projectPath, masterNarrationPath)), {
      recursive: true,
    });
    await fs.mkdir(path.dirname(path.join(created.projectPath, sequenceVideoPath)), {
      recursive: true,
    });
    await fs.mkdir(path.dirname(path.join(created.projectPath, sceneTitleCardPath)), {
      recursive: true,
    });
    await fs.mkdir(path.dirname(path.join(created.projectPath, helperSheetPath)), {
      recursive: true,
    });
    await fs.mkdir(path.dirname(path.join(created.projectPath, localizedSubtitlePath)), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(created.projectPath, masterNarrationPath),
      'audio bytes'
    );
    await fs.writeFile(
      path.join(created.projectPath, sequenceVideoPath),
      'sequence video bytes'
    );
    await fs.writeFile(
      path.join(created.projectPath, sceneTitleCardPath),
      'scene title card bytes'
    );
    await fs.writeFile(path.join(created.projectPath, helperSheetPath), 'png bytes');
    await fs.writeFile(
      path.join(created.projectPath, localizedSubtitlePath),
      'WEBVTT\n\n00:00.000 --> 00:01.000\nMerhaba\n'
    );

    const narration = await projectData.registerAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'clip', clipId: 'clip_test0001' },
      type: 'narration',
      mediaKind: 'audio',
      title: 'Narration take 1',
      projectRelativePath: masterNarrationPath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'narration',
    });
    const sequenceVideo = await projectData.registerAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'sequence', sequenceId: 'sequence_test0001' },
      type: 'video',
      mediaKind: 'video',
      title: 'Sequence video',
      projectRelativePath: sequenceVideoPath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'video',
    });
    const sceneTitleCard = await projectData.registerAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'scene', sceneId: 'scene_test0001' },
      type: 'title_card',
      mediaKind: 'image',
      title: 'Scene title card',
      projectRelativePath: sceneTitleCardPath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'title-card',
    });
    const helperSheet = await projectData.registerAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'castMember', castMemberId: 'cast_test0002' },
      type: 'character_sheet',
      mediaKind: 'image',
      title: 'Mehmed character sheet',
      projectRelativePath: helperSheetPath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'character_sheet',
    });
    const subtitles = await projectData.registerAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'clip', clipId: 'clip_test0001' },
      locale: { localeId: 'locale_test0002' },
      type: 'subtitles',
      mediaKind: 'text',
      title: 'Turkish subtitles',
      projectRelativePath: localizedSubtitlePath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'subtitles',
    });

    await projectData.createAssetSelect({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'clip', clipId: 'clip_test0001' },
      assetId: narration.assetId,
    });
    await projectData.createAssetSelect({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'sequence', sequenceId: 'sequence_test0001' },
      assetId: sequenceVideo.assetId,
    });
    await projectData.createAssetSelect({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'scene', sceneId: 'scene_test0001' },
      assetId: sceneTitleCard.assetId,
    });
    await projectData.createAssetSelect({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'castMember', castMemberId: 'cast_test0002' },
      assetId: helperSheet.assetId,
    });
    await projectData.createAssetSelect({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'clip', clipId: 'clip_test0001' },
      assetId: subtitles.assetId,
    });

    const firstExport = await projectData.exportProductionAssets({
      projectName: 'constantinople',
      homeDir,
    });

    expect(firstExport).toMatchObject({
      copiedFileCount: 4,
      skippedFileCount: 0,
      prunedFileCount: 0,
    });
    const sequenceTarget = path.join(
      created.projectPath,
      'production-assets',
      'master',
      'sequences',
      '01-the-young-sultan-s-obsession',
      'video.mp4'
    );
    const sceneTarget = path.join(
      created.projectPath,
      'production-assets',
      'master',
      'sequences',
      '01-the-young-sultan-s-obsession',
      'scenes',
      '01-a-throne-facing-an-ancient-city',
      'title-card.png'
    );
    const masterTarget = path.join(
      created.projectPath,
      'production-assets',
      'master',
      'sequences',
      '01-the-young-sultan-s-obsession',
      'scenes',
      '01-a-throne-facing-an-ancient-city',
      'clips',
      '01-the-new-sultan',
      'narration.wav'
    );
    const localizedTarget = path.join(
      created.projectPath,
      'production-assets',
      'localized',
      'tr-TR',
      'sequences',
      '01-the-young-sultan-s-obsession',
      'scenes',
      '01-a-throne-facing-an-ancient-city',
      'clips',
      '01-the-new-sultan',
      'subtitles.vtt'
    );
    await expect(fs.readFile(sequenceTarget, 'utf8')).resolves.toBe(
      'sequence video bytes'
    );
    await expect(fs.readFile(sceneTarget, 'utf8')).resolves.toBe(
      'scene title card bytes'
    );
    await expect(fs.readFile(masterTarget, 'utf8')).resolves.toBe('audio bytes');
    await expect(fs.readFile(localizedTarget, 'utf8')).resolves.toContain(
      'Merhaba'
    );
    await expect(
      fs.access(path.join(created.projectPath, 'production-assets', 'master', 'cast'))
    ).rejects.toThrow();

    const secondExport = await projectData.exportProductionAssets({
      projectName: 'constantinople',
      homeDir,
    });
    expect(secondExport).toMatchObject({
      copiedFileCount: 0,
      skippedFileCount: 4,
      prunedFileCount: 0,
    });
    expect(secondExport.variants[0]?.treeHash).toBe(firstExport.variants[0]?.treeHash);

    await fs.writeFile(path.join(created.projectPath, masterNarrationPath), 'new audio!');
    const changedExport = await projectData.exportProductionAssets({
      projectName: 'constantinople',
      homeDir,
    });
    expect(changedExport.copiedFileCount).toBe(1);
    await expect(fs.readFile(masterTarget, 'utf8')).resolves.toBe('new audio!');

    await projectData.removeAssetSelect({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'clip', clipId: 'clip_test0001' },
      assetId: narration.assetId,
    });
    const prunedExport = await projectData.exportProductionAssets({
      projectName: 'constantinople',
      homeDir,
    });
    expect(prunedExport.prunedFileCount).toBe(1);
    await expect(fs.access(masterTarget)).rejects.toThrow();
    await expect(fs.readFile(localizedTarget, 'utf8')).resolves.toContain(
      'Merhaba'
    );
  }, 10000);

  it('does not refresh asset file metadata during a production export dry run', async () => {
    const setupPath = await writeProjectSetup(homeDir);
    const projectData = createProjectDataService();
    const created = await runCreateOrSkip(
      projectData.createFromSetup({
        setupPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    );
    if (!created) {
      return;
    }

    const narrationPath =
      'working-assets/base/sequences/01-logistics/scenes/01-foundry/clips/001/narration.wav';
    await fs.mkdir(path.dirname(path.join(created.projectPath, narrationPath)), {
      recursive: true,
    });
    await fs.writeFile(path.join(created.projectPath, narrationPath), 'audio bytes');

    const narration = await projectData.registerAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'clip', clipId: 'clip_test0001' },
      type: 'narration',
      mediaKind: 'audio',
      title: 'Narration take 1',
      projectRelativePath: narrationPath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'narration',
    });
    await projectData.createAssetSelect({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'clip', clipId: 'clip_test0001' },
      assetId: narration.assetId,
    });

    const beforeDryRun = readAssetFileMetadata(
      created.databasePath,
      narration.assetId
    );

    const dryRunExport = await projectData.exportProductionAssets({
      projectName: 'constantinople',
      homeDir,
      dryRun: true,
    });

    expect(dryRunExport.copiedFileCount).toBe(1);
    expect(readAssetFileMetadata(created.databasePath, narration.assetId)).toEqual(
      beforeDryRun
    );
    await expect(
      fs.access(
        path.join(
          created.projectPath,
          'production-assets',
          'master',
          'sequences',
          '01-the-young-sultan-s-obsession',
          'scenes',
          '01-a-throne-facing-an-ancient-city',
          'clips',
          '01-the-new-sultan',
          'narration.wav'
        )
      )
    ).rejects.toThrow();
  }, 10000);

  it('rejects registering a file outside the project', async () => {
    const setupPath = await writeProjectSetup(homeDir);
    const projectData = createProjectDataService();
    const created = await runCreateOrSkip(
      projectData.createFromSetup({
        setupPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    );
    if (!created) {
      return;
    }

    await expect(
      projectData.registerAsset({
        projectName: 'constantinople',
        homeDir,
        target: { kind: 'clip', clipId: 'clip_test0001' },
        type: 'narration',
        mediaKind: 'audio',
        title: 'Outside narration',
        projectRelativePath: '../outside.wav' as ProjectRelativePath,
        fileRole: 'primary',
        role: 'narration',
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA060' });
  });

  it('rejects selecting an asset attached to another target', async () => {
    const setupPath = await writeProjectSetup(homeDir);
    const projectData = createProjectDataService();
    const created = await runCreateOrSkip(
      projectData.createFromSetup({
        setupPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    );
    if (!created) {
      return;
    }

    const assetPath = 'working-assets/base/narrative/reference.txt';
    await fs.writeFile(path.join(created.projectPath, assetPath), 'reference');
    const registered = await projectData.registerAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'project' },
      type: 'reference',
      mediaKind: 'text',
      title: 'Project reference',
      projectRelativePath: assetPath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'reference',
    });

    await expect(
      projectData.createAssetSelect({
        projectName: 'constantinople',
        homeDir,
        target: { kind: 'clip', clipId: 'clip_test0001' },
        assetId: registered.assetId,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA080' });
  });

  it('copies a PNG cover to cover.png', async () => {
    const setupPath = await writeProjectSetup(homeDir);
    const coverPath = path.join(homeDir, 'source-cover.png');
    await fs.writeFile(coverPath, 'png bytes', 'utf8');
    const projectData = createProjectDataService();

    const result = await runCreateOrSkip(
      projectData.createFromSetup({
        setupPath,
        coverPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    );
    if (!result) {
      return;
    }

    expect(result.coverPath).toBe(
      path.join(storageRoot, 'constantinople', 'cover.png')
    );
    await expect(fs.readFile(result.coverPath!, 'utf8')).resolves.toBe('png bytes');
    await expect(
      projectData.resolveCoverImage({ projectName: 'constantinople', homeDir })
    ).resolves.toBe(result.coverPath);
  });

  it('fails if the target project folder already exists', async () => {
    const setupPath = await writeProjectSetup(homeDir);
    await fs.mkdir(path.join(storageRoot, 'constantinople'), { recursive: true });

    await expect(
      createProjectDataService().createFromSetup({
        setupPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA024' });
  });

  it('lists only SQLite-backed projects from storageRoot', async () => {
    const projectData = createProjectDataService();
    const setupPath = await writeProjectSetup(homeDir);
    const created = await runCreateOrSkip(
      projectData.createFromSetup({
        setupPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    );
    if (!created) {
      return;
    }
    await fs.mkdir(path.join(storageRoot, 'notes-only'), { recursive: true });

    const library = await projectData.listLibrary({ homeDir });

    expect(library.storageRoot).toBe(storageRoot);
    expect(library.projects).toHaveLength(1);
    expect(library.projects[0]).toMatchObject({
      name: 'constantinople',
      title: 'Preparation of the Siege',
    });
  });

  it('keeps listing the project library when one project database cannot be opened', async () => {
    const projectData = createProjectDataService();
    const setupPath = await writeProjectSetup(homeDir);
    const created = await runCreateOrSkip(
      projectData.createFromSetup({
        setupPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    );
    if (!created) {
      return;
    }
    const brokenProjectFolder = path.join(storageRoot, 'broken-project');
    await fs.mkdir(path.join(brokenProjectFolder, '.renku'), { recursive: true });
    await fs.writeFile(
      path.join(brokenProjectFolder, '.renku', 'project.sqlite'),
      'not a sqlite database',
      'utf8'
    );

    const library = await projectData.listLibrary({ homeDir });

    expect(library.projects).toHaveLength(2);
    expect(library.projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'constantinople',
          validationError: null,
        }),
        expect.objectContaining({
          name: 'broken-project',
          title: 'broken-project',
          counts: null,
          validationError: expect.objectContaining({
            code: 'PROJECT_DATA044',
          }),
        }),
      ])
    );
  });

  it('warns about unknown setup fields and ignores them', async () => {
    const setupPath = await writeProjectSetup(homeDir, {
      extraProjectFields: '  visualDescription: This must not shape the database.\n',
    });
    const projectData = createProjectDataService();

    const result = await runCreateOrSkip(
      projectData.createFromSetup({
        setupPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    );
    if (!result) {
      return;
    }

    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'PROJECT_SETUP100',
        severity: 'warning',
        location: expect.objectContaining({
          path: ['project', 'visualDescription'],
        }),
      }),
    ]);
    const project = await projectData.readProject({
      projectName: 'constantinople',
      homeDir,
    });
    expect(project.identity).not.toHaveProperty('visualDescription');
  });

  it('updates project information without changing the immutable project name', async () => {
    const setupPath = await writeProjectSetup(homeDir);
    const projectData = createProjectDataService();
    const created = await runCreateOrSkip(
      projectData.createFromSetup({
        setupPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    );
    if (!created) {
      return;
    }

    const project = await projectData.updateProjectInformation({
      projectName: 'constantinople',
      homeDir,
      information: {
        title: 'The Siege Machine',
        aspectRatio: '21:9',
        logline: 'A sharper premise.',
        summary: 'A revised project summary.',
        languages: [
          {
            localeTag: 'en-US',
            displayName: 'English',
            isBase: false,
            supportsAudio: true,
            supportsSubtitles: true,
          },
          {
            localeTag: 'tr-TR',
            displayName: 'Turkish',
            isBase: true,
            supportsAudio: false,
            supportsSubtitles: true,
          },
        ],
      },
    });

    expect(project.identity).toMatchObject({
      name: 'constantinople',
      title: 'The Siege Machine',
      aspectRatio: '21:9',
      logline: 'A sharper premise.',
      summary: 'A revised project summary.',
    });
    expect(project.languages).toEqual([
      expect.objectContaining({
        localeTag: 'en-US',
        isBase: false,
        supportsAudio: true,
        supportsSubtitles: true,
      }),
      expect.objectContaining({
        localeTag: 'tr-TR',
        isBase: true,
        supportsAudio: false,
        supportsSubtitles: true,
      }),
    ]);
  });

  it('persists cleared project information text fields', async () => {
    const setupPath = await writeProjectSetup(homeDir);
    const projectData = createProjectDataService();
    const created = await runCreateOrSkip(
      projectData.createFromSetup({
        setupPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    );
    if (!created) {
      return;
    }

    await projectData.updateProjectInformation({
      projectName: 'constantinople',
      homeDir,
      information: {
        title: 'The Siege Machine',
        aspectRatio: '21:9',
        logline: 'A sharper premise.',
        summary: 'A revised project summary.',
        languages: [
          {
            localeTag: 'en-US',
            displayName: 'English',
            isBase: true,
            supportsAudio: true,
            supportsSubtitles: true,
          },
        ],
      },
    });

    const project = await projectData.updateProjectInformation({
      projectName: 'constantinople',
      homeDir,
      information: {
        title: 'The Siege Machine',
        aspectRatio: '21:9',
        logline: '',
        summary: '   ',
        languages: [
          {
            localeTag: 'en-US',
            displayName: 'English',
            isBase: true,
            supportsAudio: true,
            supportsSubtitles: true,
          },
        ],
      },
    });

    expect(project.identity.logline).toBeUndefined();
    expect(project.identity.summary).toBeUndefined();
  });

  it('clears the Markdown-backed project summary through a patch', async () => {
    const setupPath = await writeProjectSetup(homeDir);
    const projectData = createProjectDataService();
    const created = await runCreateOrSkip(
      projectData.createFromSetup({
        setupPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    );
    if (!created) {
      return;
    }

    const project = await projectData.patchProjectInformation({
      projectName: 'constantinople',
      homeDir,
      patch: { summary: null },
    });

    expect(project.identity.summary).toBeUndefined();
    await expect(
      fs.readFile(
        path.join(
          created.projectPath,
          'working-assets',
          'base',
          'narrative',
          'project-summary.md'
        ),
        'utf8'
      )
    ).resolves.toBe('');
  });

  it('reads and updates Markdown asset content by asset link', async () => {
    const starterPath = await writeNarrativeStarter(homeDir);
    const projectData = createProjectDataService();
    const created = await runCreateOrSkip(
      projectData.createFromNarrativeStarter({
        starterPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    );
    if (!created) {
      return;
    }

    const project = await projectData.readProject({
      projectName: 'constantinople',
      homeDir,
    });
    const clip = project.sequences[0]?.scenes[0]?.clips[0];
    const summaryAsset = clip?.summaryAsset;
    expect(summaryAsset).toBeDefined();
    if (!summaryAsset) {
      return;
    }

    await expect(
      projectData.readMarkdownAssetContent({
        projectName: 'constantinople',
        homeDir,
        assetId: summaryAsset.assetId,
        assetFileId: summaryAsset.assetFileId,
      })
    ).resolves.toMatchObject({
      assetId: summaryAsset.assetId,
      assetFileId: summaryAsset.assetFileId,
      projectRelativePath: summaryAsset.projectRelativePath,
      content: 'Clip summary from Markdown.\n',
    });

    const preservedMarkdown = '    npm test\n\nKeep this line.  \n\n';
    const updated = await projectData.updateMarkdownAssetContent({
      projectName: 'constantinople',
      homeDir,
      assetId: summaryAsset.assetId,
      assetFileId: summaryAsset.assetFileId,
      content: preservedMarkdown,
    });

    expect(updated.content).toMatchObject({
      assetId: summaryAsset.assetId,
      assetFileId: summaryAsset.assetFileId,
      projectRelativePath: summaryAsset.projectRelativePath,
      content: preservedMarkdown,
    });
    expect(
      updated.project.sequences[0]?.scenes[0]?.clips[0]?.summary
    ).toBe('    npm test\n\nKeep this line.');
    await expect(
      fs.readFile(
        path.join(created.projectPath, summaryAsset.projectRelativePath),
        'utf8'
      )
    ).resolves.toBe(preservedMarkdown);
  });

  it('rejects removing a locale that still has asset relationships', async () => {
    const setupPath = await writeProjectSetup(homeDir);
    const projectData = createProjectDataService();
    const created = await runCreateOrSkip(
      projectData.createFromSetup({
        setupPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    );
    if (!created) {
      return;
    }

    await expect(
      projectData.updateProjectInformation({
        projectName: 'constantinople',
        homeDir,
        information: {
          title: 'Preparation of the Siege',
          aspectRatio: '16:9',
          logline: 'A documentary about preparation before 1453.',
          summary: 'A documentary setup summary for Markdown storage.',
          languages: [
            {
              localeTag: 'tr-TR',
              displayName: 'Turkish',
              isBase: true,
              supportsAudio: true,
              supportsSubtitles: true,
            },
          ],
        },
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA058',
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: 'PROJECT_DATA057',
          message: expect.stringContaining('project_asset'),
        }),
      ]),
    });
  });

  it('collects project information validation errors', async () => {
    const setupPath = await writeProjectSetup(homeDir);
    const projectData = createProjectDataService();
    const created = await runCreateOrSkip(
      projectData.createFromSetup({
        setupPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    );
    if (!created) {
      return;
    }

    await expect(
      projectData.updateProjectInformation({
        projectName: 'constantinople',
        homeDir,
        information: {
          title: '',
          aspectRatio: '2:1',
          languages: [
            {
              localeTag: 'en-US',
              displayName: 'English',
              isBase: false,
              supportsAudio: true,
              supportsSubtitles: true,
            },
            {
              localeTag: 'en-US',
              displayName: 'English',
              isBase: false,
              supportsAudio: true,
              supportsSubtitles: true,
            },
          ],
        },
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA056',
      issues: expect.arrayContaining([
        expect.objectContaining({ code: 'PROJECT_DATA050' }),
        expect.objectContaining({ code: 'PROJECT_DATA051' }),
        expect.objectContaining({ code: 'PROJECT_DATA054' }),
        expect.objectContaining({ code: 'PROJECT_DATA055' }),
      ]),
    });
  });

  it('collects setup errors and unknown-field warnings together', () => {
    const validation = validateProjectSetup({
      kind: 'renku.projectSetup',
      version: '0.1.0',
      project: {
        nam: 'constantinople',
        title: 'Preparation of the Siege',
      },
    });

    expect(validation.setup).toBeNull();
    expect(validation.result.valid).toBe(false);
    expect(validation.result.errors).toEqual([
      expect.objectContaining({
        code: 'PROJECT_SETUP003',
        message: 'project.name is required.',
      }),
      expect.objectContaining({
        code: 'PROJECT_SETUP003',
        message: 'project.type is required.',
      }),
    ]);
    expect(validation.result.warnings).toEqual([
      expect.objectContaining({
        code: 'PROJECT_SETUP100',
        location: expect.objectContaining({ path: ['project', 'nam'] }),
      }),
    ]);
  });

  it('collects narrative starter errors and unknown-field warnings together', () => {
    const validation = validateNarrativeStarter({
      kind: 'renku.narrativeStarter',
      version: '0.1.0',
      project: {
        nam: 'constantinople',
        title: 'Preparation of the Siege',
        type: 'standaloneMovie',
        aspectRatio: '16:9',
        logline: 'A documentary about preparation before 1453.',
      },
      languages: [
        { localeTag: 'en-US', isBase: false },
        { localeTag: 'en-US', isBase: false },
      ],
      sequences: [],
    });

    expect(validation.starter).toBeNull();
    expect(validation.result.valid).toBe(false);
    expect(validation.result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'NARRATIVE_STARTER010',
          message: 'project.name is required.',
        }),
        expect.objectContaining({
          code: 'NARRATIVE_STARTER020',
          message: 'Duplicate locale tag: en-US.',
        }),
        expect.objectContaining({
          code: 'NARRATIVE_STARTER021',
        }),
        expect.objectContaining({
          code: 'NARRATIVE_STARTER040',
        }),
      ])
    );
    expect(validation.result.warnings).toEqual([
      expect.objectContaining({
        code: 'NARRATIVE_STARTER012',
        location: expect.objectContaining({ path: ['project', 'nam'] }),
      }),
    ]);
  });

  it('fails before creating a project folder when narrative starter validation has errors', async () => {
    const starterPath = await writeInvalidNarrativeStarter(homeDir);

    await expect(
      createProjectDataService().createFromNarrativeStarter({
        starterPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    ).rejects.toMatchObject({
      code: 'NARRATIVE_STARTER999',
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: 'NARRATIVE_STARTER010',
          message: 'project.title is required.',
        }),
      ]),
    });
    await expect(
      fs.stat(path.join(storageRoot, 'constantinople'))
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects narrative starter Markdown path escapes', async () => {
    const starterPath = await writeNarrativeStarter(homeDir, {
      projectSummaryFile: '../summary.md',
    });

    await expect(
      createProjectDataService().createFromNarrativeStarter({
        starterPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    ).rejects.toMatchObject({
      code: 'NARRATIVE_STARTER999',
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: 'NARRATIVE_STARTER030',
          location: expect.objectContaining({
            path: ['project', 'summaryFile'],
          }),
        }),
      ]),
    });
  });

  it('fails before creating a project folder when setup validation has errors', async () => {
    const setupPath = await writeInvalidProjectSetup(homeDir);

    await expect(
      createProjectDataService().createFromSetup({
        setupPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_SETUP999',
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: 'PROJECT_SETUP003',
          message: 'project.name is required.',
        }),
      ]),
    });
    await expect(
      fs.stat(path.join(storageRoot, 'constantinople'))
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
});

async function runCreateOrSkip<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Could not locate the bindings file')
    ) {
      console.warn('Skipping project SQLite assertion because native bindings are not built.');
      return null;
    }
    throw error;
  }
}

async function writeConfig(homeDir: string, storageRoot: string): Promise<void> {
  const configDir = path.join(homeDir, '.config', 'renku');
  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(
    path.join(configDir, 'config.yaml'),
    `version: 0.1.0\nstorageRoot: ${storageRoot}\n`,
    'utf8'
  );
}

async function writeProjectSetup(
  homeDir: string,
  options: { extraProjectFields?: string } = {}
): Promise<string> {
  const setupPath = path.join(homeDir, 'project.yaml');
  await writeSetupMarkdownFixture(
    homeDir,
    'sample-project/visual-language/lighting/practical-source-low-key-interiors/guidance.md',
    'Formal staging and controlled historical detail.'
  );
  await writeSetupMarkdownFixture(
    homeDir,
    'sample-project/visual-language/lighting/practical-source-low-key-interiors/prompt.md',
    'Warm practical candlelight, deep brown shadows.'
  );
  await writeSetupMarkdownFixture(
    homeDir,
    'sample-project/continuity/locations/mehmeds-council-chamber/description.md',
    'Formal Ottoman planning room with maps and oil lamps.'
  );
  await fs.writeFile(
    setupPath,
    `kind: renku.projectSetup
version: 0.1.0

project:
  name: constantinople
  title: Preparation of the Siege
  type: standaloneMovie
  logline: A documentary about preparation before 1453.
  summary: A documentary setup summary for Markdown storage.
${options.extraProjectFields ?? ''}

languages:
  - localeTag: en-US
    displayName: English
    isBase: true
    supportsAudio: true
    supportsSubtitles: true
  - localeTag: tr-TR
    displayName: Turkish
    supportsAudio: true
    supportsSubtitles: true

visualLanguageCategories:
  - name: Lighting
    description: Light behavior and source logic.
  - name: Camera
    description: Camera placement and motion.

visualLanguage:
  - category: Lighting
    name: Practical-source low-key interiors
    shortDescription: Warm practical interiors.
    priority: default
    guidanceFile: sample-project/visual-language/lighting/practical-source-low-key-interiors/guidance.md
    promptFile: sample-project/visual-language/lighting/practical-source-low-key-interiors/prompt.md

cast:
  - name: Narrator
    kind: narrator
    role: voiceover
  - name: Mehmed II
    kind: historical_figure
    role: protagonist

continuityReferences:
  - kind: location
    name: Mehmed's council chamber
    shortDescription: Formal Ottoman planning room.
    descriptionFile: sample-project/continuity/locations/mehmeds-council-chamber/description.md

sequences:
  - title: The Young Sultan's Obsession
    shortTitle: Ambition
    summary: Mehmed turns conquest into policy.
    scenes:
      - title: A Throne Facing an Ancient City
        summary: Mehmed's accession is framed against Constantinople.
        clips:
          - title: The New Sultan
            summary: Mehmed is introduced as controlled and ambitious.
            visualIntent: Quiet court staging.
          - title: The City In His Mind
            summary: Constantinople appears as an imperial problem.
`,
    'utf8'
  );
  return setupPath;
}

async function writeSetupMarkdownFixture(
  homeDir: string,
  relativePath: string,
  content: string
): Promise<void> {
  const filePath = path.join(homeDir, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

async function writeEpisodeProjectSetup(homeDir: string): Promise<string> {
  const setupPath = path.join(homeDir, 'episode-project.yaml');
  await fs.writeFile(
    setupPath,
    `kind: renku.projectSetup
version: 0.1.0

project:
  name: constantinople-series
  title: Preparation of the Siege
  type: series
  logline: A documentary series about preparation before 1453.

languages:
  - localeTag: en-US
    displayName: English
    isBase: true
    supportsAudio: true
    supportsSubtitles: true

episodes:
  - title: The First Preparations
    shortTitle: Preparations
    episodeNumber: 1
    summary: Mehmed turns an inherited ambition into a concrete plan.
    sequences:
      - title: The Young Sultan's Obsession
        shortTitle: Ambition
        scenes:
          - title: A Throne Facing an Ancient City
            clips:
              - title: The New Sultan
`,
    'utf8'
  );
  return setupPath;
}

async function writeNarrativeStarter(
  homeDir: string,
  options: {
    projectNameLine?: string;
    projectSummaryFile?: string;
  } = {}
): Promise<string> {
  const starterPath = path.join(homeDir, 'narrative.yaml');
  await writeSetupMarkdownFixture(
    homeDir,
    'narrative/project-summary.md',
    'Project summary from Markdown.'
  );
  await writeSetupMarkdownFixture(
    homeDir,
    'narrative/clips/new-sultan-summary.md',
    'Clip summary from Markdown.'
  );
  await writeSetupMarkdownFixture(
    homeDir,
    'narrative/clips/new-sultan-visual-intent.md',
    'Quiet court staging from Markdown.'
  );
  await writeSetupMarkdownFixture(
    homeDir,
    'narrative/visual-language/lighting-guidance.md',
    'Lighting guidance from Markdown.'
  );
  await writeSetupMarkdownFixture(
    homeDir,
    'narrative/visual-language/lighting-prompt.md',
    'Lighting prompt from Markdown.'
  );
  await writeSetupMarkdownFixture(
    homeDir,
    'narrative/continuity/mehmeds-council-chamber.md',
    'Continuity description from Markdown.'
  );
  await writeSetupMarkdownFixture(homeDir, 'narrative/cover.png', 'narrative cover');
  await fs.writeFile(
    starterPath,
    `kind: renku.narrativeStarter
version: 0.1.0

project:
${options.projectNameLine ?? '  name: constantinople\n'}  title: Preparation of the Siege
  type: standaloneMovie
  aspectRatio: "16:9"
  coverFile: narrative/cover.png
  logline: A documentary about preparation before 1453.
  summaryFile: ${options.projectSummaryFile ?? 'narrative/project-summary.md'}

languages:
  - localeTag: en-US
    displayName: English
    isBase: true
    supportsAudio: true
    supportsSubtitles: true

cast:
  - name: Narrator
    kind: narrator
    role: Voiceover
  - name: Mehmed II
    kind: historical_figure
    role: Protagonist
    shortDescription: Young Ottoman sultan.

visualLanguageCategories:
  - name: Lighting
    description: Light behavior and source logic.
  - name: Camera
    description: Camera placement and motion.

visualLanguage:
  - category: Lighting
    name: Practical-source low-key interiors
    shortDescription: Warm practical interiors.
    priority: default
    guidanceFile: narrative/visual-language/lighting-guidance.md
    promptFile: narrative/visual-language/lighting-prompt.md

continuityReferences:
  - kind: location
    name: Mehmed's council chamber
    shortDescription: Formal Ottoman planning room.
    descriptionFile: narrative/continuity/mehmeds-council-chamber.md

sequences:
  - title: The Young Sultan's Obsession
    shortTitle: Ambition
    summary: Mehmed turns conquest into policy.
    scenes:
      - title: A Throne Facing an Ancient City
        summary: Mehmed's accession is framed against Constantinople.
        clips:
          - title: The New Sultan
            summaryFile: narrative/clips/new-sultan-summary.md
            visualIntentFile: narrative/clips/new-sultan-visual-intent.md
`,
    'utf8'
  );
  return starterPath;
}

function tableColumns(database: Database.Database, tableName: string): string[] {
  return database
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .map((row) => (row as { name: string }).name);
}

function readAssetFileMetadata(
  databasePath: string,
  assetId: string
): { contentHash: string | null; sizeBytes: number | null; updatedAt: string } {
  const database = new Database(databasePath, { readonly: true });
  try {
    const row = database
      .prepare(
        `select content_hash as contentHash, size_bytes as sizeBytes,
          updated_at as updatedAt
         from asset_file
         where asset_id = ?`
      )
      .get(assetId) as
      | { contentHash: string | null; sizeBytes: number | null; updatedAt: string }
      | undefined;
    if (!row) {
      throw new Error(`Asset file was not found for asset ${assetId}.`);
    }
    return row;
  } finally {
    database.close();
  }
}

async function writeInvalidProjectSetup(homeDir: string): Promise<string> {
  const setupPath = path.join(homeDir, 'invalid-project.yaml');
  await fs.writeFile(
    setupPath,
    `kind: renku.projectSetup
version: 0.1.0

project:
  title: Preparation of the Siege
  type: standaloneMovie
`,
    'utf8'
  );
  return setupPath;
}

async function writeInvalidNarrativeStarter(homeDir: string): Promise<string> {
  const starterPath = path.join(homeDir, 'invalid-narrative.yaml');
  await fs.writeFile(
    starterPath,
    `kind: renku.narrativeStarter
version: 0.1.0

project:
  name: constantinople
  type: standaloneMovie
  aspectRatio: "16:9"
  logline: A documentary about preparation before 1453.

languages:
  - localeTag: en-US
    isBase: true

sequences:
  - title: Ambition
`,
    'utf8'
  );
  return starterPath;
}
