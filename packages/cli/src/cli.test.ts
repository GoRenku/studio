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
    expect(stdout.join('\n')).toContain('create <project-name>');
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

  it('creates a clean movie project from a positional project name', async () => {
    const storageRoot = await initializeStorageRoot();

    const exitCode = await runRenkuCli(
      [
        'create',
        'constantinople',
        '--title',
        'Preparation of the Siege',
        '--summary',
        'A SQLite-backed project summary.',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    if (isMissingSqliteBindings(exitCode, stderr)) {
      return;
    }

    expect(exitCode).toBe(0);
    expect(stdout.join('\n')).toContain('Renku project created: constantinople');
    expect(stdout.join('\n')).toContain('Current authoring project: constantinople');
    await expect(
      fs.stat(path.join(storageRoot, 'constantinople', '.renku', 'project.sqlite'))
    ).resolves.toHaveProperty('isFile');
    await expect(
      createProjectDataService().readCurrentProject({ homeDir })
    ).resolves.toMatchObject({
      projectName: 'constantinople',
      status: 'unchanged',
    });
    await expect(
      createProjectDataService().readProject({
        projectName: 'constantinople',
        homeDir,
      })
    ).resolves.toMatchObject({
      identity: { summary: 'A SQLite-backed project summary.' },
    });
    expect(stderr).toEqual([]);
  });

  it('prints JSON for renku create and opens the project as current', async () => {
    const storageRoot = await initializeStorageRoot();

    const exitCode = await runRenkuCli(
      ['create', 'json-movie', '--title', 'JSON Movie', '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    if (isMissingSqliteBindings(exitCode, stderr)) {
      return;
    }

    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      projectName: 'json-movie',
      projectPath: path.join(storageRoot, 'json-movie'),
      databasePath: path.join(storageRoot, 'json-movie', '.renku', 'project.sqlite'),
      currentProject: {
        projectName: 'json-movie',
        databasePath: path.join(storageRoot, 'json-movie', '.renku', 'project.sqlite'),
        status: 'set',
      },
    });
    expect(stderr).toEqual([]);
  });

  it('migrates a project database by project name', async () => {
    const storageRoot = await initializeStorageRoot();
    const createExitCode = await createProject();
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

  it('keeps a created project open and creates screenplay JSON through the CLI', async () => {
    const storageRoot = await initializeStorageRoot();
    const createExitCode = await createProject();
    if (isMissingSqliteBindings(createExitCode, stderr)) {
      return;
    }
    expect(createExitCode).toBe(0);

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
      status: 'unchanged',
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
        expect.objectContaining({ key: 'urban' }),
        expect.objectContaining({ key: 'foundry' }),
      ]),
    });
    expect(stderr).toEqual([]);

    stdout = [];
    stderr = [];
    const statusExitCode = await runRenkuCli(['screenplay', 'status', '--json'], {
      homeDir,
      io: captureIo(stdout, stderr),
    });

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

  it('registers and selects a scene asset through the asset command', async () => {
    const storageRoot = await initializeStorageRoot();
    const createExitCode = await createProject();
    if (isMissingSqliteBindings(createExitCode, stderr)) {
      return;
    }
    await openProjectAndCreateScreenplay();

    const project = await createProjectDataService().readProject({
      projectName: 'constantinople',
      homeDir,
    });
    const sceneId = project.sequences[0]!.scenes[0]!.id;
    const assetPath =
      'working-assets/base/sequences/01-commission/scenes/01-foundry/narration.wav';
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
        `scene:${sceneId}`,
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
      resourceKeys: [`assets:scene:${sceneId}`],
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
        `scene:${sceneId}`,
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
      resourceKeys: [`assets:scene:${sceneId}`],
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
          '01-the-commission',
          'scenes',
          '01-urban-enters-the-foundry',
          'narration.wav'
        ),
        'utf8'
      )
    ).resolves.toBe('audio bytes');
    expect(stderr).toEqual([]);
  });

  it('fails clearly when create is missing the project name or title', async () => {
    const missingName = await runRenkuCli(['create'], {
      homeDir,
      io: captureIo(stdout, stderr),
    });

    expect(missingName).toBe(1);
    expect(stderr.join('\n')).toContain('Missing required project name');

    stdout = [];
    stderr = [];
    const missingTitle = await runRenkuCli(['create', 'constantinople'], {
      homeDir,
      io: captureIo(stdout, stderr),
    });

    expect(missingTitle).toBe(1);
    expect(stderr.join('\n')).toContain('Missing required --title');
  });

  it('rejects file-based project creation and unsafe project names', async () => {
    const fileExitCode = await runRenkuCli(
      ['create', '--file', path.join(homeDir, 'project.yaml')],
      {
        homeDir,
        io: captureIo(stdout, stderr),
      }
    );

    expect(fileExitCode).toBe(1);
    expect(stderr.join('\n')).toContain('Project creation does not accept --file');

    const storageRoot = await initializeStorageRoot();
    expect(storageRoot).toBe(path.join(homeDir, 'movies'));
    stdout = [];
    stderr = [];
    const unsafeExitCode = await runRenkuCli(
      ['create', '../outside', '--title', 'Outside', '--json'],
      {
        homeDir,
        io: captureIo(stdout, stderr),
      }
    );

    expect(unsafeExitCode).toBe(1);
    expect(JSON.parse(stderr.join('\n'))).toMatchObject({
      valid: false,
      error: { code: 'PROJECT_DATA025' },
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
          suggestion:
            'Open an existing project with `renku project open <project-name>`, or create a new project with `renku create <project-name> --title <title>`.',
        }),
      ],
    });
  });

  it('prints structured JSON when screenplay show is run without a current authoring project', async () => {
    const exitCode = await runRenkuCli(['screenplay', 'show', '--json'], {
      homeDir,
      io: captureIo(stdout, stderr),
    });

    expect(exitCode).toBe(1);
    expect(stdout).toEqual([]);
    expect(JSON.parse(stderr.join('\n'))).toMatchObject({
      valid: false,
      error: { code: 'PROJECT_DATA202' },
      errors: [
        expect.objectContaining({
          code: 'PROJECT_DATA202',
          message: 'No current authoring project is open.',
          suggestion:
            'Open an existing project with `renku project open <project-name>`, or create a new project with `renku create <project-name> --title <title>`.',
        }),
      ],
    });
  });

  it('rejects unknown CLI flags before running a command', async () => {
    const exitCode = await runRenkuCli(
      ['create', 'constantinople', '--title', 'Title', '--unexpected-input=cover.png', '--json'],
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

  async function initializeStorageRoot(): Promise<string> {
    const storageRoot = path.join(homeDir, 'movies');
    const exitCode = await runRenkuCli(['init', storageRoot], {
      homeDir,
      io: captureIo(stdout, stderr),
    });
    expect(exitCode).toBe(0);
    stdout = [];
    stderr = [];
    return storageRoot;
  }

  async function createProject(): Promise<number> {
    return await runRenkuCli(
      ['create', 'constantinople', '--title', 'Preparation of the Siege'],
      { homeDir, io: captureIo(stdout, stderr) }
    );
  }

  async function openProjectAndCreateScreenplay(): Promise<void> {
    stdout = [];
    stderr = [];
    const openExitCode = await runRenkuCli(
      ['project', 'open', 'constantinople', '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(openExitCode).toBe(0);

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
  }
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

function minimalScreenplayJson() {
  return {
    kind: 'screenplayCreate',
    screenplay: {
      title: 'Urban Basilica',
    },
    cast: [
      {
        key: 'urban',
        handle: 'urban',
        name: 'Urban',
      },
    ],
    locations: [
      {
        key: 'foundry',
        handle: 'foundry',
        name: 'Foundry',
      },
    ],
    acts: [
      {
        key: 'act-one',
        title: 'Act I',
        sequences: [
          {
            key: 'commission',
            title: 'The Commission',
            scenes: [
              {
                key: 'first-scene',
                title: 'Urban Enters The Foundry',
                setting: {
                  locationReferences: [{ key: 'foundry' }],
                },
                blocks: [
                  {
                    type: 'action',
                    text: 'Urban studies the cracked bronze.',
                    castMemberReferences: [{ key: 'urban' }],
                    locationReferences: [{ key: 'foundry' }],
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
