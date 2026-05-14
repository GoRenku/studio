import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
} from '../index.js';
import {
  runCreateOrSkip,
  tableColumns,
  writeConfig,
  writeEpisodeProjectSetup,
  writeMinimalProjectSetup,
  writeNarrativeProjectSetup,
  writeProjectSetup,
} from '../testing/project-data-fixtures.js';

describe('create project from setup', () => {
  let homeDir: string;
  let storageRoot: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-create-project-from-setup-test-'));
    storageRoot = path.join(homeDir, 'projects');
    await writeConfig(homeDir, storageRoot);
  });

  it('creates a blank standalone project from minimal setup YAML', async () => {
    const setupPath = await writeMinimalProjectSetup(homeDir);
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
      projectName: 'blank-movie',
      created: {
        languages: 0,
        castMembers: 0,
        visualLanguageCategories: 0,
        visualLanguage: 0,
        continuityReferences: 0,
        episodes: 0,
        sequences: 0,
        scenes: 0,
        clips: 0,
      },
    });
    await expect(
      projectData.readProject({
        projectName: 'blank-movie',
        homeDir,
      })
    ).resolves.toMatchObject({
      identity: {
        name: 'blank-movie',
        title: 'Blank Movie',
        type: 'standaloneMovie',
      },
      sequences: [],
      episodes: [],
      cast: [],
      visualLanguage: [],
      continuityReferences: [],
    });
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
    const castDesign = await projectData.readCastDesignResource({
      projectName: 'constantinople',
      homeDir,
      castMemberId: 'cast_test0002',
    });
    expect(castDesign.descriptionAsset).toMatchObject({
      role: 'description',
      projectRelativePath: 'working-assets/base/cast/02-mehmed-ii/description.md',
    });
    await expect(
      projectData.readMarkdownAssetContent({
        projectName: 'constantinople',
        homeDir,
        assetId: castDesign.descriptionAsset?.assetId ?? '',
        assetFileId: castDesign.descriptionAsset?.assetFileId ?? '',
      })
    ).resolves.toMatchObject({
      content: 'Cast description from Markdown.\n',
    });
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

    const shell = await projectData.readProjectShell({
      projectName: 'constantinople',
      homeDir,
    });
    expect(shell).not.toHaveProperty('sequences');
    expect(shell).not.toHaveProperty('episodes');
    expect(shell.counts).toMatchObject({
      sequences: 1,
      scenes: 1,
      clips: 2,
    });
    expect(shell.navigation.narrative).toMatchObject({
      projectType: 'standaloneMovie',
      sequences: {
        items: [
          expect.objectContaining({
            id: 'sequence_test0001',
            number: 1,
            title: "The Young Sultan's Obsession",
            sceneCount: 1,
            clipCount: 2,
          }),
        ],
      },
    });
    const scenePage = await projectData.listSceneNavigation({
      projectName: 'constantinople',
      homeDir,
      sequenceId: 'sequence_test0001',
    });
    expect(scenePage.items).toEqual([
      expect.objectContaining({
        id: 'scene_test0001',
        title: 'A Throne Facing an Ancient City',
        clipCount: 2,
      }),
    ]);
    const clipPage = await projectData.listClipNavigation({
      projectName: 'constantinople',
      homeDir,
      sceneId: 'scene_test0001',
      limit: 1,
    });
    expect(clipPage.items).toEqual([
      expect.objectContaining({
        id: 'clip_test0001',
        title: 'The New Sultan',
      }),
    ]);
    expect(clipPage.nextCursor).toEqual(expect.any(String));
    await expect(
      projectData.readStudioSelectionContext({
        projectName: 'constantinople',
        homeDir,
        selection: { type: 'clip', id: 'clip_test0002' },
      })
    ).resolves.toMatchObject({
      valid: true,
      context: {
        surface: 'clip-design',
        sequence: expect.objectContaining({
          id: 'sequence_test0001',
          number: 1,
          sceneCount: 1,
          clipCount: 2,
        }),
        scene: expect.objectContaining({
          id: 'scene_test0001',
          clipCount: 2,
        }),
        clip: expect.objectContaining({
          id: 'clip_test0002',
          title: 'The City In His Mind',
        }),
      },
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

    const shell = await projectData.readProjectShell({
      projectName: 'constantinople-series',
      homeDir,
    });
    expect(shell).not.toHaveProperty('sequences');
    expect(shell).not.toHaveProperty('episodes');
    expect(shell.navigation.narrative).toMatchObject({
      projectType: 'series',
      episodes: {
        items: [
          expect.objectContaining({
            title: 'The First Preparations',
            sequenceCount: 1,
            sceneCount: 1,
            clipCount: 1,
          }),
        ],
      },
    });
  });

  it('creates a project from narrative setup YAML with Markdown references', async () => {
    const setupPath = await writeNarrativeProjectSetup(homeDir);
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
    expect(project.visualLanguage[0]).toMatchObject({
      name: 'Practical-source low-key interiors',
      guidance: 'Lighting guidance from Markdown.',
      prompt: 'Lighting prompt from Markdown.',
      guidanceAsset: expect.objectContaining({ role: 'guidance' }),
      promptAsset: expect.objectContaining({ role: 'prompt' }),
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

  it('copies a setup-relative PNG cover to cover.png', async () => {
    await fs.mkdir(path.join(homeDir, 'sample-project'), { recursive: true });
    await fs.writeFile(
      path.join(homeDir, 'sample-project', 'source-cover.png'),
      'png bytes',
      'utf8'
    );
    const setupPath = await writeProjectSetup(homeDir, {
      extraProjectFields: '  coverFile: sample-project/source-cover.png\n',
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

    expect(result.coverPath).toBe(
      path.join(storageRoot, 'constantinople', 'cover.png')
    );
    await expect(fs.readFile(result.coverPath!, 'utf8')).resolves.toBe('png bytes');
    await expect(
      projectData.resolveCoverImage({ projectName: 'constantinople', homeDir })
    ).resolves.toBe(result.coverPath);
  });

  it('fails if coverFile escapes the setup folder', async () => {
    const setupPath = await writeProjectSetup(homeDir, {
      extraProjectFields: '  coverFile: ../cover.png\n',
    });

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
          code: 'PROJECT_SETUP006',
          location: expect.objectContaining({
            path: ['project', 'coverFile'],
          }),
        }),
      ]),
    });
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
