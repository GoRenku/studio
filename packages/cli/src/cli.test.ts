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
    expect(stdout.join('\n')).toContain('generation');
    expect(stdout.join('\n')).toContain('media');
    expect(stderr).toEqual([]);
  });

  it('fails clearly when generation model list is missing a purpose', async () => {
    const exitCode = await runRenkuCli(
      ['generation', 'model', 'list', '--media-kind', 'image', '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );

    expect(exitCode).toBe(1);
    expect(JSON.parse(stderr.join('\n'))).toMatchObject({
      error: { code: 'CLI001' },
    });
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

  it('validates and writes Inspiration analysis through the top-level command', async () => {
    const storageRoot = await initializeStorageRoot();
    const createExitCode = await createProject();
    if (isMissingSqliteBindings(createExitCode, stderr)) {
      return;
    }
    expect(createExitCode).toBe(0);

    stdout = [];
    stderr = [];
    const createFolderExitCode = await runRenkuCli(
      ['inspiration', 'create', '--name', 'Blade Runner 2049', '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(createFolderExitCode).toBe(0);
    const folder = JSON.parse(stdout.join('\n')) as {
      id: string;
      projectRelativePath: string;
    };

    const inspirationFolderPath = path.join(
      storageRoot,
      'constantinople',
      folder.projectRelativePath
    );
    await fs.writeFile(path.join(inspirationFolderPath, 'frame-001.png'), 'image bytes');

    const analysisPath = path.join(homeDir, 'inspiration-analysis.json');
    await fs.writeFile(
      analysisPath,
      JSON.stringify(inspirationAnalysisJson('frame-001.png'), null, 2),
      'utf8'
    );

    stdout = [];
    stderr = [];
    const showExitCode = await runRenkuCli(
      ['inspiration', 'show', '--folder', folder.id, '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(showExitCode).toBe(0);
    const showReport = JSON.parse(stdout.join('\n'));
    expect(showReport).toMatchObject({
      valid: true,
      folder: {
        id: folder.id,
        absolutePath: inspirationFolderPath,
      },
      analysis: null,
    });
    expect(showReport.images).toBeUndefined();

    stdout = [];
    stderr = [];
    const validateExitCode = await runRenkuCli(
      [
        'inspiration',
        'analysis',
        'validate',
        '--folder',
        folder.id,
        '--file',
        analysisPath,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(validateExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      valid: true,
      folder: { id: folder.id },
    });

    stdout = [];
    stderr = [];
    const writeExitCode = await runRenkuCli(
      [
        'inspiration',
        'analysis',
        'write',
        '--folder',
        folder.id,
        '--file',
        analysisPath,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(writeExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      valid: true,
      changes: [{ type: 'inspirationAnalysis.upserted', folderId: folder.id }],
      analysis: {
        folderId: folder.id,
        thesis: { statement: expect.stringContaining('Reference images') },
      },
      resourceKeys: expect.arrayContaining([
        'surface:visual-language:inspiration',
        `surface:visual-language:inspiration:${folder.id}`,
      ]),
    });

    stdout = [];
    stderr = [];
    const oldCommandExitCode = await runRenkuCli(
      [
        'visual-language',
        'inspiration',
        'read',
        '--folder',
        folder.id,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(oldCommandExitCode).toBe(1);
    expect(JSON.parse(stderr.join('\n'))).toMatchObject({
      error: { code: 'CLI091' },
    });
  });

  it('validates and creates Lookbooks through the top-level command', async () => {
    const storageRoot = await initializeStorageRoot();
    const createExitCode = await createProject();
    if (isMissingSqliteBindings(createExitCode, stderr)) {
      return;
    }
    expect(createExitCode).toBe(0);

    stdout = [];
    stderr = [];
    const createFolderExitCode = await runRenkuCli(
      ['inspiration', 'create', '--name', 'The Substance', '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(createFolderExitCode).toBe(0);
    const folder = JSON.parse(stdout.join('\n')) as {
      id: string;
      projectRelativePath: string;
    };
    const inspirationFolderPath = path.join(
      storageRoot,
      'constantinople',
      folder.projectRelativePath
    );

    const lookbookPath = path.join(homeDir, 'lookbook.json');
    await fs.writeFile(
      lookbookPath,
      JSON.stringify(lookbookJson([folder.id]), null, 2),
      'utf8'
    );

    stdout = [];
    stderr = [];
    const validateExitCode = await runRenkuCli(
      ['lookbook', 'validate', '--file', lookbookPath, '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(validateExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      valid: true,
      sourceInspirationFolders: [
        {
          id: folder.id,
          absolutePath: inspirationFolderPath,
        },
      ],
    });

    stdout = [];
    stderr = [];
    const createLookbookExitCode = await runRenkuCli(
      [
        'lookbook',
        'create',
        '--name',
        'Contaminated Tenderness',
        '--file',
        lookbookPath,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(createLookbookExitCode).toBe(0);
    const report = JSON.parse(stdout.join('\n'));
    expect(report).toMatchObject({
      valid: true,
      changes: [{ type: 'lookbook.created' }],
      lookbook: {
        name: 'Contaminated Tenderness',
        palette: { colors: [{ hex: '#39FF75' }] },
      },
      sourceInspirationFolders: [{ id: folder.id }],
      resourceKeys: expect.arrayContaining([
        'surface:visual-language:lookbooks',
      ]),
    });

    stdout = [];
    stderr = [];
    const showExitCode = await runRenkuCli(
      ['lookbook', 'show', '--lookbook', report.lookbook.id, '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(showExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      valid: true,
      lookbook: { id: report.lookbook.id },
      sourceInspirationFolders: [{ id: folder.id }],
      imagesBySection: { palette: [] },
    });

    stdout = [];
    stderr = [];
    const contextExitCode = await runRenkuCli(
      [
        'generation',
        'context',
        '--purpose',
        'lookbook.image',
        '--target',
        `lookbook:${report.lookbook.id}`,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(contextExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      purpose: 'lookbook.image',
      target: { kind: 'lookbook', id: report.lookbook.id },
      lookbook: { id: report.lookbook.id },
      defaults: {
        takeCount: 1,
        detail: 'standard',
      },
    });

    stdout = [];
    stderr = [];
    const modelListExitCode = await runRenkuCli(
      [
        'generation',
        'model',
        'list',
        '--purpose',
        'lookbook.image',
        '--target',
        `lookbook:${report.lookbook.id}`,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(modelListExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      purpose: 'lookbook.image',
      models: expect.arrayContaining([
        expect.objectContaining({
          modelChoice: 'fal-ai/nano-banana-2',
          available: true,
        }),
      ]),
    });

    const generatedPath = 'generated/media/lookbook-palette.png';
    await fs.mkdir(path.dirname(path.join(storageRoot, 'constantinople', generatedPath)), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(storageRoot, 'constantinople', generatedPath),
      'image bytes'
    );

    stdout = [];
    stderr = [];
    const mediaImportExitCode = await runRenkuCli(
      [
        'media',
        'import',
        '--purpose',
        'lookbook.image',
        '--target',
        `lookbook:${report.lookbook.id}`,
        '--source',
        generatedPath,
        '--sections',
        'palette,lighting',
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(mediaImportExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      purpose: 'lookbook.image',
      imported: {
        sections: ['palette', 'lighting'],
        asset: {
          files: [
            {
              projectRelativePath: 'visual-language/lookbook/lookbook-palette.png',
            },
          ],
        },
      },
    });

    const specPath = path.join(homeDir, 'lookbook-image-spec.json');
    await fs.writeFile(
      specPath,
      JSON.stringify(
        {
          purpose: 'lookbook.image',
          target: { kind: 'lookbook', id: report.lookbook.id },
          modelChoice: 'fal-ai/nano-banana-2',
          prompt: 'A simulated Lookbook palette frame.',
          focusSections: ['palette', 'lighting'],
          takeCount: 1,
          seed: null,
          imageFrame: '16:9',
          detail: 'draft',
          outputFormat: 'png',
          title: 'Simulated Lookbook',
        },
        null,
        2
      ),
      'utf8'
    );

    stdout = [];
    stderr = [];
    const specCreateExitCode = await runRenkuCli(
      [
        'generation',
        'spec',
        'create',
        '--file',
        specPath,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(specCreateExitCode).toBe(0);
    const createdSpec = JSON.parse(stdout.join('\n')) as { id: string };

    stdout = [];
    stderr = [];
    const estimateExitCode = await runRenkuCli(
      ['generation', 'estimate', '--spec', createdSpec.id, '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(estimateExitCode).toBe(0);
    const estimate = JSON.parse(stdout.join('\n')) as {
      estimate: { approvalToken: string };
    };
    expect(estimate.estimate.approvalToken).toMatch(/^sha256:/);

    stdout = [];
    stderr = [];
    const runExitCode = await runRenkuCli(
      [
        'generation',
        'run',
        '--spec',
        createdSpec.id,
        '--simulate',
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(runExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      run: {
        provider: 'fal-ai',
        model: 'nano-banana-2',
        simulated: true,
        outputs: [
          {
            projectRelativePath: 'generated/media/simulated-lookbook.png',
          },
        ],
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
      'shotlist/sequences/01-commission/scenes/01-foundry/narration.wav';
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

function inspirationAnalysisJson(imageFile: string) {
  return {
    kind: 'inspirationAnalysis',
    analysis: {
      thesis: {
        statement: 'Reference images use quiet contrast. The visual logic is restrained and precise.',
        principles: ['Preserve motivated contrast.'],
        imageFiles: [imageFile],
      },
      palette: {
        description: 'Muted colors with disciplined warmth.',
        colors: [
          { hex: '#AABBCC', name: 'Cold dawn', meaning: 'Distance and control.' },
        ],
        observations: [{ text: 'Blue-gray dominates.', imageFiles: [imageFile] }],
      },
      toneMood: {
        tone: 'weathered restraint',
        moodTags: ['restrained'],
        description: 'Low saturation and soft contrast keep the images subdued.',
        imageFiles: [imageFile],
      },
      composition: {
        description: 'Frames favor stillness and pressure.',
        patterns: [
          {
            name: 'Centered pressure',
            description: 'Subjects hold center while negative space bears down.',
            imageFiles: [imageFile],
          },
        ],
      },
      lighting: {
        description: 'Light is motivated and directional.',
        patterns: [
          {
            name: 'Practical falloff',
            description: 'Faces fall away quickly from practical sources.',
            imageFiles: [imageFile],
          },
        ],
      },
      texture: {
        description: 'Surfaces feel tactile and worn.',
        observations: [{ text: 'Soft grain supports worn surfaces.', imageFiles: [imageFile] }],
      },
      inspiredBy: {
        description: 'Visual lineage is treated as affinity, not confirmed influence.',
        items: [
          {
            category: 'cinematographer',
            name: 'Roger Deakins',
            confidence: 'medium',
            why: 'Controlled contrast and disciplined negative space are visible affinities.',
            imageFiles: [imageFile],
          },
        ],
      },
    },
  };
}

function lookbookJson(sourceInspirationFolderIds: string[] = []) {
  return {
    kind: 'lookbook',
    lookbook: {
      thesis: {
        statement:
          'The movie should feel tender and contaminated at once. Beauty is never clean, and threat is never purely hostile.',
        principles: ['Let attraction and danger share the same frame.'],
      },
      palette: {
        description:
          'Acid green marks contamination and tenderness, held against fleshy reds and clinic whites.',
        colors: [
          {
            hex: '#39FF75',
            name: 'Acid tenderness',
            meaning: 'A charged color for care that has become unstable.',
          },
        ],
        observations: [{ text: 'Green should feel alive rather than decorative.' }],
      },
      toneMood: {
        tone: 'surgical intimacy',
        moodTags: ['charged', 'bodily'],
        description: 'Clean surfaces should feel too bright and too close.',
      },
      composition: {
        description: 'Faces and bodies press into symmetrical frames.',
        patterns: [
          {
            name: 'Clinical symmetry',
            description: 'Use centered frames when a body becomes an argument.',
          },
        ],
      },
      lighting: {
        description: 'High-key institutional light breaks into colored threat.',
        patterns: [
          {
            name: 'Contaminated practicals',
            description: 'Let green sources corrupt otherwise clean environments.',
          },
        ],
      },
      texture: {
        description: 'Skin, gloss, condensation, and plastic carry the image.',
        observations: [{ text: 'Texture should make clean rooms feel biological.' }],
      },
      camera: {
        description: 'The camera is precise until bodily pressure breaks composure.',
        movement: [
          {
            name: 'Controlled drift',
            description: 'Move slowly when desire and unease merge.',
          },
        ],
        motion: [
          {
            name: 'Sudden rupture',
            description: 'Reserve abrupt motion for moments when control collapses.',
          },
        ],
        framing: [
          {
            name: 'Body as diagram',
            description: 'Frame bodies like evidence without losing empathy.',
          },
        ],
      },
    },
    sourceInspirationFolderIds,
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
