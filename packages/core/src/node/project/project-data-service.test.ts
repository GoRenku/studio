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
        visualLanguage: 1,
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
      projectRelativePath: 'Working Assets/Base/Narrative/project-summary.md',
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
    expect(project.visualLanguage[0]).toMatchObject({
      summary: 'Muted golds, deep reds, formal court staging.',
      intent: 'Formal staging and controlled historical detail.',
      intentAsset: expect.objectContaining({
        role: 'intent',
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
          'Working Assets',
          'Base',
          'Narrative',
          'project-summary.md'
        ),
        'utf8'
      )
    ).resolves.toBe('A documentary setup summary for Markdown storage.\n');

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
          'visual_language_asset',
          'sequence_asset',
          'scene_asset',
          'clip_asset',
        ])
      );
      expect(tables).not.toContain('project_language');
      expect(tableColumns(database, 'project')).not.toContain('summary');
      expect(tableColumns(database, 'visual_language')).not.toContain('intent');
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
        'Working Assets/Base/Narrative/project-summary.md'
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
      'Working Assets/Base/Sequences/01-logistics/Scenes/01-foundry/Clips/001/narration.wav';
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

    const assetPath = 'Working Assets/Base/Narrative/reference.txt';
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
          'Working Assets',
          'Base',
          'Narrative',
          'project-summary.md'
        ),
        'utf8'
      )
    ).resolves.toBe('');
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

visualLanguage:
  - name: Ottoman court miniature influence
    intent: Formal staging and controlled historical detail.
    summary: Muted golds, deep reds, formal court staging.

cast:
  - name: Narrator
    kind: narrator
    role: voiceover
  - name: Mehmed II
    kind: historical_figure
    role: protagonist

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

function tableColumns(database: Database.Database, tableName: string): string[] {
  return database
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .map((row) => (row as { name: string }).name);
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
