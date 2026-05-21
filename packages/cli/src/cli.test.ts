import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createProjectDataService } from '@gorenku/studio-core/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { runRenkuCli } from './cli.js';

describe('renku CLI', () => {
  let homeDir: string;
  let stdout: string[];
  let stderr: string[];

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-cli-test-'));
    stdout = [];
    stderr = [];
  });

  it('shows top-level help with the renku binary and init command', async () => {
    const exitCode = await runRenkuCli([], {
      homeDir,
      io: captureIo(stdout, stderr),
    });

    expect(exitCode).toBe(0);
    expect(stdout.join('\n')).toContain('$ renku <command>');
    expect(stdout.join('\n')).toContain('create --file <yaml>');
    expect(stdout.join('\n')).toContain('init <storage-root>');
    expect(stderr).toEqual([]);
  });

  it('creates config with renku init <storage-root>', async () => {
    const storageRoot = path.join(homeDir, 'movies');

    const exitCode = await runRenkuCli(['init', storageRoot], {
      homeDir,
      io: captureIo(stdout, stderr),
    });

    expect(exitCode).toBe(0);
    expect(stdout.join('\n')).toContain('Renku config created.');
    expect(stdout.join('\n')).toContain(`Storage root: ${storageRoot}`);
    expect(stderr).toEqual([]);
    await expect(
      fs.readFile(path.join(homeDir, '.config', 'renku', 'config.yaml'), 'utf8')
    ).resolves.toContain(`storageRoot: ${storageRoot}`);
  });

  it('prints JSON for renku init <storage-root> --json', async () => {
    const storageRoot = path.join(homeDir, 'movies');

    const exitCode = await runRenkuCli(['init', storageRoot, '--json'], {
      homeDir,
      io: captureIo(stdout, stderr),
    });

    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toEqual({
      status: 'created',
      configPath: path.join(homeDir, '.config', 'renku', 'config.yaml'),
      storageRoot,
    });
    expect(stderr).toEqual([]);
  });

  it('fails clearly when init is missing a storage root', async () => {
    const exitCode = await runRenkuCli(['init'], {
      homeDir,
      io: captureIo(stdout, stderr),
    });

    expect(exitCode).toBe(1);
    expect(stdout).toEqual([]);
    expect(stderr.join('\n')).toContain(
      'Missing required storage root. Usage: renku init <storage-root>'
    );
  });

  it('reports existing config without overwriting it', async () => {
    const firstStorageRoot = path.join(homeDir, 'first');
    const secondStorageRoot = path.join(homeDir, 'second');

    await runRenkuCli(['init', firstStorageRoot], {
      homeDir,
      io: captureIo(stdout, stderr),
    });
    stdout = [];
    stderr = [];

    const exitCode = await runRenkuCli(['init', secondStorageRoot], {
      homeDir,
      io: captureIo(stdout, stderr),
    });

    expect(exitCode).toBe(0);
    expect(stdout.join('\n')).toContain('Renku config already exists.');
    expect(stdout.join('\n')).toContain(`Storage root: ${firstStorageRoot}`);
    expect(stdout.join('\n')).not.toContain(secondStorageRoot);
    expect(stderr).toEqual([]);
  });

  it('creates a project from fixture YAML', async () => {
    const storageRoot = path.join(homeDir, 'movies');
    await runRenkuCli(['init', storageRoot], {
      homeDir,
      io: captureIo(stdout, stderr),
    });
    stdout = [];
    stderr = [];
    const yamlPath = await writeCreateYaml(homeDir);

    const exitCode = await runRenkuCli(['create', '--file', yamlPath], {
      homeDir,
      io: captureIo(stdout, stderr),
    });
    if (isMissingSqliteBindings(exitCode, stderr)) {
      return;
    }

    expect(exitCode).toBe(0);
    expect(stdout.join('\n')).toContain('Renku project created: constantinople');
    await expect(
      fs.stat(path.join(storageRoot, 'constantinople', '.renku', 'project.sqlite'))
    ).resolves.toHaveProperty('isFile');
    expect(stderr).toEqual([]);
  });

  it('creates a project from pre-authored screenplay setup YAML', async () => {
    const storageRoot = path.join(homeDir, 'movies');
    await runRenkuCli(['init', storageRoot], {
      homeDir,
      io: captureIo(stdout, stderr),
    });
    stdout = [];
    stderr = [];
    const yamlPath = await writeScreenplayYaml(homeDir);

    const exitCode = await runRenkuCli(['create', '--file', yamlPath], {
      homeDir,
      io: captureIo(stdout, stderr),
    });
    if (isMissingSqliteBindings(exitCode, stderr)) {
      return;
    }

    expect(exitCode).toBe(0);
    expect(stdout.join('\n')).toContain('Renku project created: constantinople');
    await expect(
      fs.stat(path.join(storageRoot, 'constantinople', '.renku', 'project.sqlite'))
    ).resolves.toHaveProperty('isFile');
    expect(stderr).toEqual([]);
  });

  it('migrates a project database by project name', async () => {
    const storageRoot = path.join(homeDir, 'movies');
    await runRenkuCli(['init', storageRoot], {
      homeDir,
      io: captureIo(stdout, stderr),
    });
    stdout = [];
    stderr = [];
    const yamlPath = await writeCreateYaml(homeDir);
    const createExitCode = await runRenkuCli(['create', '--file', yamlPath], {
      homeDir,
      io: captureIo(stdout, stderr),
    });
    if (isMissingSqliteBindings(createExitCode, stderr)) {
      return;
    }
    expect(createExitCode).toBe(0);

    stdout = [];
    stderr = [];
    const migrateExitCode = await runRenkuCli(
      ['project', 'migrate', 'constantinople'],
      {
        homeDir,
        io: captureIo(stdout, stderr),
      }
    );

    expect(migrateExitCode).toBe(0);
    expect(stdout.join('\n')).toContain(
      'Renku project database migrated: constantinople'
    );
    expect(stdout.join('\n')).toContain(
      path.join(storageRoot, 'constantinople', '.renku', 'project.sqlite')
    );
    expect(stderr).toEqual([]);
  });

  it('prints JSON for project database migration', async () => {
    const storageRoot = path.join(homeDir, 'movies');
    await runRenkuCli(['init', storageRoot], {
      homeDir,
      io: captureIo(stdout, stderr),
    });
    stdout = [];
    stderr = [];
    const yamlPath = await writeCreateYaml(homeDir);
    const createExitCode = await runRenkuCli(['create', '--file', yamlPath], {
      homeDir,
      io: captureIo(stdout, stderr),
    });
    if (isMissingSqliteBindings(createExitCode, stderr)) {
      return;
    }
    expect(createExitCode).toBe(0);

    stdout = [];
    stderr = [];
    const migrateExitCode = await runRenkuCli(
      ['project', 'migrate', 'constantinople', '--json'],
      {
        homeDir,
        io: captureIo(stdout, stderr),
      }
    );

    expect(migrateExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toEqual({
      projectName: 'constantinople',
      projectPath: path.join(storageRoot, 'constantinople'),
      databasePath: path.join(storageRoot, 'constantinople', '.renku', 'project.sqlite'),
    });
    expect(stderr).toEqual([]);
  });

  it('shows project usage when migrate is missing a project name', async () => {
    const exitCode = await runRenkuCli(['project', 'migrate'], {
      homeDir,
      io: captureIo(stdout, stderr),
    });

    expect(exitCode).toBe(1);
    expect(stdout).toEqual([]);
    expect(stderr.join('\n')).toContain(
      'Usage: renku project current|open <project-name>|close|select <project-name>|migrate <project-name>'
    );
  });

  it('reports a structured error when project migration cannot find a database', async () => {
    const storageRoot = path.join(homeDir, 'movies');
    await runRenkuCli(['init', storageRoot], {
      homeDir,
      io: captureIo(stdout, stderr),
    });
    stdout = [];
    stderr = [];

    const exitCode = await runRenkuCli(
      ['project', 'migrate', 'constantinople', '--json'],
      {
        homeDir,
        io: captureIo(stdout, stderr),
      }
    );

    expect(exitCode).toBe(1);
    expect(stdout).toEqual([]);
    expect(JSON.parse(stderr.join('\n'))).toMatchObject({
      valid: false,
      error: {
        code: 'PROJECT_DATA020',
      },
    });
  });

  it('opens an authoring project and creates screenplay JSON through the CLI', async () => {
    const storageRoot = path.join(homeDir, 'movies');
    await runRenkuCli(['init', storageRoot], {
      homeDir,
      io: captureIo(stdout, stderr),
    });
    stdout = [];
    stderr = [];
    const yamlPath = await writeCreateYaml(homeDir);
    const createProjectExitCode = await runRenkuCli(['create', '--file', yamlPath], {
      homeDir,
      io: captureIo(stdout, stderr),
    });
    if (isMissingSqliteBindings(createProjectExitCode, stderr)) {
      return;
    }
    expect(createProjectExitCode).toBe(0);

    stdout = [];
    stderr = [];
    const openExitCode = await runRenkuCli(
      ['project', 'open', 'constantinople', '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );

    expect(openExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      projectName: 'constantinople',
      projectId: expect.any(String),
      databasePath: path.join(storageRoot, 'constantinople', '.renku', 'project.sqlite'),
      status: 'set',
    });
    expect(stderr).toEqual([]);

    const screenplayPath = path.join(homeDir, 'screenplay.json');
    await fs.writeFile(
      screenplayPath,
      JSON.stringify(minimalScreenplayJson(), null, 2),
      'utf8'
    );

    stdout = [];
    stderr = [];
    const screenplayExitCode = await runRenkuCli(
      ['screenplay', 'create', '--file', screenplayPath, '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );

    expect(screenplayExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      valid: true,
      project: { name: 'constantinople' },
      changes: [{ operation: 'screenplay.create' }],
      generatedIds: expect.arrayContaining([
        expect.objectContaining({ localKey: 'urban' }),
        expect.objectContaining({ localKey: 'foundry' }),
      ]),
    });
    expect(stderr).toEqual([]);

    stdout = [];
    stderr = [];
    const statusExitCode = await runRenkuCli(
      ['screenplay', 'status', '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );

    expect(statusExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      exists: true,
      counts: {
        castMembers: 1,
        locations: 1,
        acts: 1,
        sequences: 1,
        scenes: 1,
        blocks: 1,
      },
    });
  });

  it('prints structured JSON when screenplay create is run without a current authoring project', async () => {
    const screenplayPath = path.join(homeDir, 'screenplay.json');
    await fs.writeFile(
      screenplayPath,
      JSON.stringify(minimalScreenplayJson(), null, 2),
      'utf8'
    );

    const exitCode = await runRenkuCli(
      ['screenplay', 'create', '--file', screenplayPath, '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );

    expect(exitCode).toBe(1);
    expect(stdout).toEqual([]);
    expect(JSON.parse(stderr.join('\n'))).toMatchObject({
      valid: false,
      error: { code: 'PROJECT_DATA202' },
      errors: [
        expect.objectContaining({
          code: 'PROJECT_DATA202',
          suggestion: 'Run `renku project open <project-name>` before using screenplay commands.',
        }),
      ],
    });
  });

  it('rejects unknown CLI flags before running a command', async () => {
    const storageRoot = path.join(homeDir, 'movies');
    await runRenkuCli(['init', storageRoot], {
      homeDir,
      io: captureIo(stdout, stderr),
    });
    stdout = [];
    stderr = [];
    const yamlPath = await writeCreateYaml(homeDir);

    const exitCode = await runRenkuCli(
      ['create', '--file', yamlPath, '--unexpected-input=cover.png', '--json'],
      {
        homeDir,
        io: captureIo(stdout, stderr),
      }
    );

    expect(exitCode).toBe(1);
    expect(stdout).toEqual([]);
    const report = JSON.parse(stderr.join('\n'));
    expect(report).toMatchObject({
      valid: false,
      error: {
        code: 'CLI005',
      },
      errors: [
        expect.objectContaining({
          code: 'CLI005',
          message: 'Unknown flag: --unexpected-input=cover.png.',
        }),
      ],
    });
  });

  it('prints warnings for unknown setup fields and still creates the project', async () => {
    const storageRoot = path.join(homeDir, 'movies');
    await runRenkuCli(['init', storageRoot], {
      homeDir,
      io: captureIo(stdout, stderr),
    });
    stdout = [];
    stderr = [];
    const yamlPath = await writeCreateYaml(homeDir, {
      extraProjectFields: '  visualDescription: This field is ignored.\n',
    });

    const exitCode = await runRenkuCli(['create', '--file', yamlPath], {
      homeDir,
      io: captureIo(stdout, stderr),
    });
    if (isMissingSqliteBindings(exitCode, stderr)) {
      return;
    }

    expect(exitCode).toBe(0);
    expect(stdout.join('\n')).toContain('Renku project created: constantinople');
    expect(stderr.join('\n')).toContain('[PROJECT_SETUP100] WARNING');
    expect(stderr.join('\n')).toContain('project.visualDescription');
  });

  it('creates a project with YAML coverFile and JSON output', async () => {
    const storageRoot = path.join(homeDir, 'movies');
    await runRenkuCli(['init', storageRoot], {
      homeDir,
      io: captureIo(stdout, stderr),
    });
    stdout = [];
    stderr = [];
    await fs.mkdir(path.join(homeDir, 'screenplay'), { recursive: true });
    await fs.writeFile(path.join(homeDir, 'screenplay', 'cover.png'), 'cover', 'utf8');
    const yamlPath = await writeCreateYaml(homeDir, {
      extraProjectFields: '  coverFile: screenplay/cover.png\n',
    });

    const exitCode = await runRenkuCli(
      ['create', '--file', yamlPath, '--json'],
      {
        homeDir,
        io: captureIo(stdout, stderr),
      }
    );
    if (isMissingSqliteBindings(exitCode, stderr)) {
      return;
    }

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout.join('\n'));
    expect(result).toMatchObject({
      projectName: 'constantinople',
      coverPath: path.join(storageRoot, 'constantinople', 'cover.png'),
      warnings: [],
    });
    await expect(fs.readFile(result.coverPath, 'utf8')).resolves.toBe('cover');
    expect(stderr).toEqual([]);
  });

  it('registers and selects an asset through the asset command', async () => {
    const storageRoot = path.join(homeDir, 'movies');
    await runRenkuCli(['init', storageRoot], {
      homeDir,
      io: captureIo(stdout, stderr),
    });
    stdout = [];
    stderr = [];
    const yamlPath = await writeCreateYaml(homeDir);
    const createExitCode = await runRenkuCli(['create', '--file', yamlPath], {
      homeDir,
      io: captureIo(stdout, stderr),
    });
    if (isMissingSqliteBindings(createExitCode, stderr)) {
      return;
    }
    expect(createExitCode).toBe(0);

    const project = await createProjectDataService().readProject({
      projectName: 'constantinople',
      homeDir,
    });
    const clipId = project.sequences[0]!.scenes[0]!.clips[0]!.id;
    const assetPath =
      'Working Assets/Base/Sequences/01-logistics/Scenes/01-foundry/Clips/001/narration.wav';
    await fs.mkdir(path.dirname(path.join(storageRoot, 'constantinople', assetPath)), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(storageRoot, 'constantinople', assetPath),
      'audio bytes'
    );

    stdout = [];
    stderr = [];
    const registerExitCode = await runRenkuCli(
      [
        'asset',
        'register',
        '--project',
        'constantinople',
        '--target',
        `clip:${clipId}`,
        '--type',
        'narration',
        '--media-kind',
        'audio',
        '--role',
        'narration',
        '--file-role',
        'primary',
        '--file',
        assetPath,
        '--title',
        'Narration take 1',
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );

    expect(registerExitCode).toBe(0);
    const registered = JSON.parse(stdout.join('\n')) as {
      asset: { assetId: string };
      resourceKeys: string[];
    };
    expect(registered).toMatchObject({
      asset: {
        type: 'narration',
        selection: { kind: 'take' },
      },
      resourceKeys: [
        `assets:clip:${clipId}`,
        `surface:clip-design:${clipId}`,
      ],
    });

    stdout = [];
    stderr = [];
    const selectExitCode = await runRenkuCli(
      [
        'asset',
        'select',
        '--project',
        'constantinople',
        '--target',
        `clip:${clipId}`,
        registered.asset.assetId,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );

    expect(selectExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      asset: {
        assetId: registered.asset.assetId,
        selection: { kind: 'select', order: 1 },
      },
      resourceKeys: [
        `assets:clip:${clipId}`,
        `surface:clip-design:${clipId}`,
      ],
    });

    stdout = [];
    stderr = [];
    const exportExitCode = await runRenkuCli(
      ['production', 'export', '--project', 'constantinople', '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );

    expect(exportExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      copiedFileCount: 1,
      skippedFileCount: 0,
      prunedFileCount: 0,
    });
    await expect(
      fs.readFile(
        path.join(
          storageRoot,
          'constantinople',
          'production-assets',
          'master',
          'sequences',
          '01-opening',
          'scenes',
          '01-first-scene',
          'narration.wav'
        ),
        'utf8'
      )
    ).resolves.toBe('audio bytes');
    expect(stderr).toEqual([]);
  });

  it('fails clearly when create is missing --file', async () => {
    const exitCode = await runRenkuCli(['create'], {
      homeDir,
      io: captureIo(stdout, stderr),
    });

    expect(exitCode).toBe(1);
    expect(stderr.join('\n')).toContain('Missing required create input');
  });

  it('fails clearly when create receives a positional project name', async () => {
    const exitCode = await runRenkuCli(['create', 'constantinople'], {
      homeDir,
      io: captureIo(stdout, stderr),
    });

    expect(exitCode).toBe(1);
    expect(stderr.join('\n')).toContain('Project names are read from project.name');
  });

  it('prints JSON diagnostics to stderr when create --json validation fails', async () => {
    const storageRoot = path.join(homeDir, 'movies');
    await runRenkuCli(['init', storageRoot], {
      homeDir,
      io: captureIo(stdout, stderr),
    });
    stdout = [];
    stderr = [];
    const yamlPath = await writeInvalidCreateYaml(homeDir);

    const exitCode = await runRenkuCli(['create', '--file', yamlPath, '--json'], {
      homeDir,
      io: captureIo(stdout, stderr),
    });

    expect(exitCode).toBe(1);
    expect(stdout).toEqual([]);
    const report = JSON.parse(stderr.join('\n'));
    expect(report).toMatchObject({
      valid: false,
      error: {
        code: 'PROJECT_SETUP999',
      },
      errors: [
        expect.objectContaining({
          code: 'PROJECT_SETUP003',
          message: 'project.name is required.',
        }),
      ],
      warnings: [
        expect.objectContaining({
          code: 'PROJECT_SETUP100',
        }),
      ],
    });
  });
});

function captureIo(stdout: string[], stderr: string[]) {
  return {
    stdout: {
      log(message: string) {
        stdout.push(message);
      },
    },
    stderr: {
      error(message: string) {
        stderr.push(message);
      },
    },
  };
}

async function writeCreateYaml(
  homeDir: string,
  options: { extraProjectFields?: string } = {}
): Promise<string> {
  const yamlPath = path.join(homeDir, 'project.yaml');
  await fs.writeFile(
    yamlPath,
    `kind: renku.projectSetup
version: 0.1.0

project:
  name: constantinople
  title: Preparation of the Siege
  type: standaloneMovie
${options.extraProjectFields ?? ''}

sequences:
  - title: Opening
    scenes:
      - title: First Scene
        clips:
          - title: First Clip
`,
    'utf8'
  );
  return yamlPath;
}

async function writeInvalidCreateYaml(homeDir: string): Promise<string> {
  const yamlPath = path.join(homeDir, 'invalid-project.yaml');
  await fs.writeFile(
    yamlPath,
    `kind: renku.projectSetup
version: 0.1.0

project:
  nam: constantinople
  title: Preparation of the Siege
  type: standaloneMovie
`,
    'utf8'
  );
  return yamlPath;
}

async function writeScreenplayYaml(homeDir: string): Promise<string> {
  const yamlPath = path.join(homeDir, 'screenplay.yaml');
  await fs.writeFile(
    yamlPath,
    `kind: renku.projectSetup
version: 0.1.0

project:
  name: constantinople
  title: Preparation of the Siege
  type: standaloneMovie
  aspectRatio: "16:9"
  logline: A documentary about preparation before 1453.
  summary: A screenplay setup summary.

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

visualLanguageCategories:
  - name: Lighting
    description: Light behavior.

visualLanguage:
  - category: Lighting
    name: Practical interiors
    shortDescription: Warm practical interiors.
    priority: default
    guidance: Use candle and oil lamp motivation.
    prompt: Warm practical candlelight.

continuityReferences:
  - kind: location
    name: Mehmed's council chamber
    shortDescription: Formal Ottoman planning room.
    description: Maps, oil lamps, textiles, and controlled court staging.

sequences:
  - title: Opening
    scenes:
      - title: First Scene
        clips:
          - title: First Clip
            summary: A first clip.
`,
    'utf8'
  );
  return yamlPath;
}

function minimalScreenplayJson() {
  return {
    kind: 'screenplay',
    screenplay: {
      title: 'Urban Basilica',
    },
    cast: [
      {
        localKey: 'urban',
        name: 'Urban',
      },
    ],
    locations: [
      {
        localKey: 'foundry',
        name: 'Foundry',
      },
    ],
    acts: [
      {
        localKey: 'act-one',
        title: 'Act I',
        sequences: [
          {
            localKey: 'commission',
            title: 'The Commission',
            scenes: [
              {
                localKey: 'first-scene',
                title: 'Urban Enters The Foundry',
                setting: {
                  locationRefs: [{ localKey: 'foundry' }],
                },
                blocks: [
                  {
                    localKey: 'first-block',
                    type: 'action',
                    text: 'Urban studies the cracked bronze.',
                    castMemberRefs: [{ localKey: 'urban' }],
                    locationRefs: [{ localKey: 'foundry' }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

function isMissingSqliteBindings(exitCode: number, stderr: string[]): boolean {
  if (
    exitCode === 1 &&
    stderr.some((line) => line.includes('Could not locate the bindings file'))
  ) {
    console.warn('Skipping CLI create assertion because native bindings are not built.');
    return true;
  }
  return false;
}
