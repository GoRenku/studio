import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  claimStudioRuntimeDescriptor,
  createProjectDataService,
  createStudioCoordinationService,
  resolveStudioEventStorePath,
  resolveStudioRuntimeDescriptorPath,
} from '@gorenku/studio-core/server';
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

    const facts = await seedCliFacts();
    const screenplayPath = path.join(homeDir, 'screenplay.json');
    await fs.writeFile(
      screenplayPath,
      JSON.stringify(minimalScreenplayJson(facts), null, 2),
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
        expect.objectContaining({ key: 'act-one' }),
        expect.objectContaining({ key: 'commission' }),
        expect.objectContaining({ key: 'first-scene' }),
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

  it('shows a cast member from the documented positional id', async () => {
    await initializeStorageRoot();
    const createExitCode = await createProject();
    if (isMissingSqliteBindings(createExitCode, stderr)) {
      return;
    }
    expect(createExitCode).toBe(0);

    const facts = await seedCliFacts();

    stdout = [];
    stderr = [];
    const showExitCode = await runRenkuCli(
      ['cast', 'show', facts.castMemberId, '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );

    expect(showExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      id: facts.castMemberId,
      handle: 'urban',
      name: 'Urban',
    });
    expect(stderr).toEqual([]);
  });

  it('validates, writes, lists, and activates Screenplay Analysis through the CLI', async () => {
    await initializeStorageRoot();
    const createExitCode = await createProject();
    if (isMissingSqliteBindings(createExitCode, stderr)) {
      return;
    }
    expect(createExitCode).toBe(0);

    stdout = [];
    stderr = [];
    expect(
      await runRenkuCli(['project', 'open', 'constantinople', '--json'], {
        homeDir,
        io: captureIo(stdout, stderr),
      })
    ).toBe(0);

    const facts = await seedCliFacts();
    const screenplayPath = path.join(homeDir, 'screenplay-three-act.json');
    await fs.writeFile(
      screenplayPath,
      JSON.stringify(threeActScreenplayJson(facts), null, 2),
      'utf8'
    );
    stdout = [];
    stderr = [];
    expect(
      await runRenkuCli(
        ['screenplay', 'create', '--file', screenplayPath, '--json'],
        { homeDir, io: captureIo(stdout, stderr) }
      )
    ).toBe(0);

    stdout = [];
    stderr = [];
    expect(
      await runRenkuCli(['screenplay', 'analyze', 'context', '--json'], {
        homeDir,
        io: captureIo(stdout, stderr),
      })
    ).toBe(0);
    const context = JSON.parse(stdout.join('\n'));
    expect(context).toMatchObject({
      valid: true,
      defaultCriteria: [
        expect.objectContaining({ key: 'dramaticEnergy' }),
        expect.objectContaining({ key: 'stakes' }),
        expect.objectContaining({ key: 'characterAgency' }),
      ],
      activeAnalysis: null,
    });

    const analysisPath = path.join(homeDir, 'screenplay-analysis.json');
    await fs.writeFile(
      analysisPath,
      JSON.stringify(screenplayAnalysisJson(context), null, 2),
      'utf8'
    );

    stdout = [];
    stderr = [];
    expect(
      await runRenkuCli(
        ['screenplay', 'analyze', 'validate', '--file', analysisPath, '--json'],
        { homeDir, io: captureIo(stdout, stderr) }
      )
    ).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      valid: true,
      analysis: { kind: 'screenplayAnalysis' },
    });

    stdout = [];
    stderr = [];
    expect(
      await runRenkuCli(
        ['screenplay', 'analyze', 'write', '--file', analysisPath, '--json'],
        { homeDir, io: captureIo(stdout, stderr) }
      )
    ).toBe(0);
    const writeReport = JSON.parse(stdout.join('\n'));
    expect(writeReport).toMatchObject({
      valid: true,
      changes: [
        { type: 'screenplayAnalysis.created' },
        { type: 'screenplayAnalysis.activeSet' },
      ],
      resourceKeys: expect.arrayContaining([
        'surface:story-arc',
        'screenplay-analysis',
      ]),
    });

    stdout = [];
    stderr = [];
    expect(
      await runRenkuCli(['screenplay', 'analyze', 'list', '--json'], {
        homeDir,
        io: captureIo(stdout, stderr),
      })
    ).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      activeAnalysisId: writeReport.analysis.id,
      analyses: [expect.objectContaining({ id: writeReport.analysis.id })],
    });

    stdout = [];
    stderr = [];
    expect(
      await runRenkuCli(['screenplay', 'analyze', 'show', '--active', '--json'], {
        homeDir,
        io: captureIo(stdout, stderr),
      })
    ).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      summary: { id: writeReport.analysis.id },
      analysis: { kind: 'screenplayAnalysis' },
    });

  });

  it('validates and writes Inspiration analysis through the top-level command', async () => {
    const storageRoot = await initializeStorageRoot();
    const createExitCode = await createProject();
    if (isMissingSqliteBindings(createExitCode, stderr)) {
      return;
    }
    expect(createExitCode).toBe(0);
    await openProjectAndCreateScreenplay();

    stdout = [];
    stderr = [];
    const createFolderExitCode = await runRenkuCli(
      ['inspiration', 'create', '--name', 'Blade Runner 2049', '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(createFolderExitCode).toBe(0);
    const createFolderReport = JSON.parse(stdout.join('\n')) as {
      folder: {
        id: string;
        projectRelativePath: string;
      };
      resourceKeys: string[];
    };
    const folder = createFolderReport.folder;
    expect(createFolderReport.resourceKeys).toEqual(
      expect.arrayContaining([
        'surface:visual-language:inspiration',
        `surface:visual-language:inspiration:${folder.id}`,
      ])
    );

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
    await openProjectAndCreateScreenplay();

    stdout = [];
    stderr = [];
    const createFolderExitCode = await runRenkuCli(
      ['inspiration', 'create', '--name', 'The Substance', '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(createFolderExitCode).toBe(0);
    const createFolderReport = JSON.parse(stdout.join('\n')) as {
      folder: {
        id: string;
        projectRelativePath: string;
      };
      resourceKeys: string[];
    };
    const folder = createFolderReport.folder;
    expect(createFolderReport.resourceKeys).toEqual(
      expect.arrayContaining([
        'surface:visual-language:inspiration',
        `surface:visual-language:inspiration:${folder.id}`,
      ])
    );
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
        type: 'movie',
        definition: { palette: { colors: [{ hex: '#39FF75' }] } },
      },
      sourceInspirationFolders: [{ id: folder.id }],
      resourceKeys: expect.arrayContaining([
        'surface:visual-language:lookbooks',
      ]),
    });

    stdout = [];
    stderr = [];
    const selectMovieLookbookExitCode = await runRenkuCli(
      [
        'lookbook',
        'select',
        '--type',
        'movie',
        '--lookbook',
        report.lookbook.id,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(selectMovieLookbookExitCode).toBe(0);

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

    stdout = [];
    stderr = [];
    const sheetContextExitCode = await runRenkuCli(
      [
        'generation',
        'context',
        '--purpose',
        'lookbook.sheet',
        '--target',
        `lookbook:${report.lookbook.id}`,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(sheetContextExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      purpose: 'lookbook.sheet',
      target: { kind: 'lookbook', id: report.lookbook.id },
      lookbook: { id: report.lookbook.id },
      defaults: {
        takeCount: 1,
        sheetFrame: 'project',
        detail: 'standard',
      },
    });

    stdout = [];
    stderr = [];
    const sheetModelListExitCode = await runRenkuCli(
      [
        'generation',
        'model',
        'list',
        '--purpose',
        'lookbook.sheet',
        '--target',
        `lookbook:${report.lookbook.id}`,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(sheetModelListExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      purpose: 'lookbook.sheet',
      models: expect.arrayContaining([
        expect.objectContaining({
          modelChoice: 'fal-ai/nano-banana-2',
          available: true,
        }),
      ]),
    });

    stdout = [];
    stderr = [];
    const sheetSpecListExitCode = await runRenkuCli(
      [
        'generation',
        'spec',
        'list',
        '--purpose',
        'lookbook.sheet',
        '--target',
        `lookbook:${report.lookbook.id}`,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(sheetSpecListExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      specs: [],
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
    const mediaImportReport = JSON.parse(stdout.join('\n'));
    expect(mediaImportReport).toMatchObject({
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

    stdout = [];
    stderr = [];
    const placementExitCode = await runRenkuCli(
      [
        'lookbook',
        'image',
        'set-placement',
        '--image',
        mediaImportReport.imported.id,
        '--sections',
        'thesis,lighting',
        '--anchor',
        'lighting-contaminated-practicals',
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(placementExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      image: {
        id: mediaImportReport.imported.id,
        sections: ['thesis'],
        points: ['lighting-contaminated-practicals'],
      },
    });

    stdout = [];
    stderr = [];
    const lookbookReadExitCode = await runRenkuCli(
      [
        'lookbook',
        'show',
        '--lookbook',
        report.lookbook.id,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(lookbookReadExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      imagesBySection: {
        thesis: [expect.objectContaining({ id: mediaImportReport.imported.id })],
      },
      imagesByPoint: {
        'lighting-contaminated-practicals': [
          expect.objectContaining({ id: mediaImportReport.imported.id }),
        ],
      },
    });

    const generatedSheetPath = 'generated/media/imperial-wound-lookbook-sheet.png';
    await fs.writeFile(
      path.join(storageRoot, 'constantinople', generatedSheetPath),
      'sheet image bytes'
    );

    stdout = [];
    stderr = [];
    const sheetImportExitCode = await runRenkuCli(
      [
        'media',
        'import',
        '--purpose',
        'lookbook.sheet',
        '--target',
        `lookbook:${report.lookbook.id}`,
        '--source',
        generatedSheetPath,
        '--title',
        'Imperial Wound lookbook sheet',
        '--summary',
        'Model-facing visual language guide.',
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(sheetImportExitCode).toBe(0);
    const sheetImportReport = JSON.parse(stdout.join('\n'));
    expect(sheetImportReport).toMatchObject({
      purpose: 'lookbook.sheet',
      imported: {
        asset: {
          type: 'lookbook_sheet',
          title: 'Imperial Wound lookbook sheet',
          oneLineSummary: 'Model-facing visual language guide.',
          files: [
            {
              role: 'source',
              projectRelativePath:
                'visual-language/lookbook/imperial-wound-lookbook-sheet.png',
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
      estimate: {
        approvalToken: string;
      };
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

    const project = await createProjectDataService().readProject({
      projectName: 'constantinople',
      homeDir,
    });
    const castMemberId = project.cast[0]!.id;

    stdout = [];
    stderr = [];
    const castContextExitCode = await runRenkuCli(
      [
        'generation',
        'context',
        '--purpose',
        'cast.character-sheet',
        '--target',
        `cast:${castMemberId}`,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(castContextExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      purpose: 'cast.character-sheet',
      target: { kind: 'castMember', id: castMemberId },
      castMember: { name: 'Urban' },
      activeLookbook: { lookbook: { id: report.lookbook.id } },
    });

    const characterSheetSpecPath = path.join(homeDir, 'cast-character-sheet-spec.json');
    await fs.writeFile(
      characterSheetSpecPath,
      JSON.stringify(
        {
          purpose: 'cast.character-sheet',
          target: { kind: 'castMember', id: castMemberId },
          modelChoice: 'fal-ai/nano-banana-2',
          prompt: 'A simulated full character sheet for Urban.',
          takeCount: 1,
          seed: null,
          imageFrame: '16:9',
          detail: 'draft',
          outputFormat: 'png',
          title: 'Urban Character Sheet',
        },
        null,
        2
      ),
      'utf8'
    );

    stdout = [];
    stderr = [];
    const characterSheetCreateExitCode = await runRenkuCli(
      ['generation', 'spec', 'create', '--file', characterSheetSpecPath, '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(characterSheetCreateExitCode).toBe(0);
    const characterSheetSpec = JSON.parse(stdout.join('\n')) as { id: string };

    stdout = [];
    stderr = [];
    const characterSheetRunExitCode = await runRenkuCli(
      ['generation', 'run', '--spec', characterSheetSpec.id, '--simulate', '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(characterSheetRunExitCode).toBe(0);
    const characterSheetRun = JSON.parse(stdout.join('\n')) as {
      run: { outputs: Array<{ projectRelativePath: string }> };
    };

    stdout = [];
    stderr = [];
    const characterSheetImportExitCode = await runRenkuCli(
      [
        'media',
        'import',
        '--purpose',
        'cast.character-sheet',
        '--target',
        `cast:${castMemberId}`,
        '--source',
        characterSheetRun.run.outputs[0]!.projectRelativePath,
        '--reference-name',
        'standard-sheet',
        '--reference-purpose',
        'default costume and face reference',
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(characterSheetImportExitCode).toBe(0);
    const characterSheetImport = JSON.parse(stdout.join('\n')) as {
      imported: { assetId: string; files: Array<{ projectRelativePath: string }> };
    };
    expect(characterSheetImport).toMatchObject({
      purpose: 'cast.character-sheet',
      imported: {
        role: 'character_sheet',
        files: [
          {
            projectRelativePath:
              'cast/urban/character-sheets/urban-character-sheet.png',
          },
        ],
      },
    });

    const profileSpecPath = path.join(homeDir, 'cast-profile-spec.json');
    await fs.writeFile(
      profileSpecPath,
      JSON.stringify(
        {
          purpose: 'cast.profile',
          target: { kind: 'castMember', id: castMemberId },
          modelChoice: 'fal-ai/nano-banana-2/edit',
          sourceAssetId: characterSheetImport.imported.assetId,
          prompt: 'A simulated square profile portrait for Urban from the sheet.',
          takeCount: 1,
          seed: null,
          imageFrame: '1:1',
          detail: 'draft',
          outputFormat: 'png',
          title: 'Urban Profile',
        },
        null,
        2
      ),
      'utf8'
    );

    stdout = [];
    stderr = [];
    const profileCreateExitCode = await runRenkuCli(
      ['generation', 'spec', 'create', '--file', profileSpecPath, '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(profileCreateExitCode).toBe(0);
    const profileSpec = JSON.parse(stdout.join('\n')) as { id: string };

    stdout = [];
    stderr = [];
    const profileRunExitCode = await runRenkuCli(
      ['generation', 'run', '--spec', profileSpec.id, '--simulate', '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(profileRunExitCode).toBe(0);
    const profileRun = JSON.parse(stdout.join('\n')) as {
      run: { outputs: Array<{ projectRelativePath: string }> };
    };
    expect(profileRun).toMatchObject({
      run: {
        provider: 'fal-ai',
        model: 'nano-banana-2/edit',
        simulated: true,
        purpose: 'cast.profile',
      },
    });

    stdout = [];
    stderr = [];
    const profileImportExitCode = await runRenkuCli(
      [
        'media',
        'import',
        '--purpose',
        'cast.profile',
        '--target',
        `cast:${castMemberId}`,
        '--source',
        profileRun.run.outputs[0]!.projectRelativePath,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(profileImportExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      purpose: 'cast.profile',
      imported: {
        role: 'profile',
        files: [
          {
            projectRelativePath: 'cast/urban/profiles/urban-profile.png',
          },
        ],
      },
    });

    const locationId = project.locations[0]!.id;

    stdout = [];
    stderr = [];
    const locationContextExitCode = await runRenkuCli(
      [
        'generation',
        'context',
        '--purpose',
        'location.environment-sheet',
        '--target',
        `location:${locationId}`,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(locationContextExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      purpose: 'location.environment-sheet',
      target: { kind: 'location', id: locationId },
      defaults: {
        sheetFrame: '4:3',
        viewFrame: '16:9',
      },
      activeLookbook: { lookbook: { id: report.lookbook.id } },
    });

    stdout = [];
    stderr = [];
    const locationModelListExitCode = await runRenkuCli(
      [
        'generation',
        'model',
        'list',
        '--purpose',
        'location.environment-sheet',
        '--target',
        `location:${locationId}`,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(locationModelListExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      models: expect.arrayContaining([
        expect.objectContaining({
          modelChoice: 'fal-ai/nano-banana-2',
          available: true,
        }),
      ]),
    });

    const locationSpecPath = path.join(homeDir, 'location-environment-sheet-spec.json');
    await fs.writeFile(
      locationSpecPath,
      JSON.stringify(
        {
          purpose: 'location.environment-sheet',
          target: { kind: 'location', id: locationId },
          modelChoice: 'fal-ai/nano-banana-2',
          prompt: 'A simulated four-view environment sheet for the council chamber.',
          takeCount: 1,
          seed: null,
          sheetFrame: '4:3',
          viewFrame: '16:9',
          detail: 'draft',
          outputFormat: 'png',
          title: 'Council Chamber Environment Sheet',
        },
        null,
        2
      ),
      'utf8'
    );

    stdout = [];
    stderr = [];
    const locationCreateExitCode = await runRenkuCli(
      ['generation', 'spec', 'create', '--file', locationSpecPath, '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(locationCreateExitCode).toBe(0);
    const locationSpec = JSON.parse(stdout.join('\n')) as { id: string };

    stdout = [];
    stderr = [];
    const locationRunExitCode = await runRenkuCli(
      ['generation', 'run', '--spec', locationSpec.id, '--simulate', '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(locationRunExitCode).toBe(0);
    const locationRun = JSON.parse(stdout.join('\n')) as {
      run: {
        outputs: Array<{ projectRelativePath: string }>;
      };
    };
    expect(locationRun).toMatchObject({
      run: {
        provider: 'fal-ai',
        model: 'nano-banana-2',
        simulated: true,
        purpose: 'location.environment-sheet',
        outputs: [
          expect.objectContaining({
            projectRelativePath: 'generated/media/council-chamber-environment-sheet.png',
          }),
        ],
      },
    });

    const locationImportFilePath = path.join(
      homeDir,
      'location-environment-sheet-import.json'
    );
    const locationViewFiles = {
      view_front: 'generated/media/council-chamber-front.png',
      view_right: 'generated/media/council-chamber-right.png',
      view_back: 'generated/media/council-chamber-back.png',
      view_left: 'generated/media/council-chamber-left.png',
    };
    await fs.mkdir(path.join(storageRoot, 'constantinople', 'generated/media'), {
      recursive: true,
    });
    for (const [role, projectRelativePath] of Object.entries(locationViewFiles)) {
      await fs.writeFile(
        path.join(storageRoot, 'constantinople', projectRelativePath),
        role
      );
    }
    await fs.writeFile(
      locationImportFilePath,
      JSON.stringify(
        {
          title: 'Council Chamber Environment Sheet',
          files: {
            composite: locationRun.run.outputs[0]!.projectRelativePath,
            ...locationViewFiles,
          },
        },
        null,
        2
      ),
      'utf8'
    );

    stdout = [];
    stderr = [];
    const locationImportExitCode = await runRenkuCli(
      [
        'media',
        'import',
        '--purpose',
        'location.environment-sheet',
        '--target',
        `location:${locationId}`,
        '--file',
        locationImportFilePath,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(locationImportExitCode).toBe(0);
    const locationImportReport = JSON.parse(stdout.join('\n'));
    expect(locationImportReport).toMatchObject({
      purpose: 'location.environment-sheet',
      imported: {
        role: 'environment_sheet',
        files: expect.arrayContaining([
          expect.objectContaining({ role: 'composite' }),
          expect.objectContaining({ role: 'view_front' }),
          expect.objectContaining({ role: 'view_right' }),
          expect.objectContaining({ role: 'view_back' }),
          expect.objectContaining({ role: 'view_left' }),
        ]),
      },
      files: [
        expect.objectContaining({ role: 'composite' }),
        expect.objectContaining({ role: 'view_front' }),
        expect.objectContaining({ role: 'view_right' }),
        expect.objectContaining({ role: 'view_back' }),
        expect.objectContaining({ role: 'view_left' }),
      ],
    });
    expect(JSON.stringify(locationImportReport)).not.toContain('crop');
    expect(JSON.stringify(locationImportReport)).not.toContain('extraction');
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

  it('attaches, lists, shows, and removes a Cast Voice through the CLI', async () => {
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
    const castMemberId = project.cast[0]!.id;
    const samplePath = 'generated/audio/urban-normal.mp3';
    await fs.mkdir(path.dirname(path.join(storageRoot, 'constantinople', samplePath)), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(storageRoot, 'constantinople', samplePath),
      'voice bytes'
    );

    const attachmentPath = path.join(homeDir, 'cast-voice-attachment.json');
    await fs.writeFile(
      attachmentPath,
      JSON.stringify(
        {
          kind: 'castVoiceAttachment',
          castMemberId,
          name: 'normal-voice',
          provider: 'elevenlabs',
          model: 'eleven_v3',
          voiceId: 'voice_urban_normal',
          purpose: 'calm strategic baseline',
          sample: {
            sourceProjectRelativePath: samplePath,
            title: 'Urban normal voice sample',
            receipt: {
              run: {
                provider: 'elevenlabs',
                model: 'eleven_v3',
              },
            },
          },
        },
        null,
        2
      ),
      'utf8'
    );

    stdout = [];
    stderr = [];
    const validateExitCode = await runRenkuCli(
      ['cast', 'voice', 'validate', '--project', 'constantinople', '--file', attachmentPath, '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(validateExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toEqual({ valid: true, warnings: [] });

    const providerAttachmentPath = path.join(
      homeDir,
      'cast-voice-elevenlabs-sample-attachment.json'
    );
    await fs.writeFile(
      providerAttachmentPath,
      JSON.stringify(
        {
          kind: 'castVoiceElevenLabsSampleAttachment',
          castMemberId,
          name: 'provider-voice',
          provider: 'elevenlabs',
          model: 'eleven_v3',
          voiceId: 'voice_urban_provider',
          purpose: 'calm strategic baseline',
          sample: {
            title: 'Urban provider voice sample',
          },
        },
        null,
        2
      ),
      'utf8'
    );

    stdout = [];
    stderr = [];
    const providerValidateExitCode = await runRenkuCli(
      [
        'cast',
        'voice',
        'validate',
        '--project',
        'constantinople',
        '--file',
        providerAttachmentPath,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(providerValidateExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toEqual({ valid: true, warnings: [] });

    stdout = [];
    stderr = [];
    const attachExitCode = await runRenkuCli(
      ['cast', 'voice', 'attach', '--project', 'constantinople', '--file', attachmentPath, '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(attachExitCode).toBe(0);
    const attached = JSON.parse(stdout.join('\n')) as {
      voice: {
        id: string;
        name: string;
        sample: { assetId: string };
        providerRegistrations: Array<{ id: string }>;
      };
    };
    expect(attached).toMatchObject({
      voice: {
        name: 'normal-voice',
        sampleSource: { kind: 'generated_sample' },
        providerRegistrations: [
          expect.objectContaining({
            provider: 'elevenlabs',
            registrationModel: 'eleven_v3',
            externalVoiceId: 'voice_urban_normal',
            capabilities: ['dialogue-audio-tts'],
          }),
        ],
        sample: {
          role: 'voice_sample',
          files: [
            {
              projectRelativePath: 'cast/urban/voice-samples/urban-normal.mp3',
            },
          ],
        },
      },
    });

    stdout = [];
    stderr = [];
    const listExitCode = await runRenkuCli(
      ['cast', 'voice', 'list', '--project', 'constantinople', '--cast', castMemberId, '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(listExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      voices: [expect.objectContaining({ id: attached.voice.id })],
    });

    stdout = [];
    stderr = [];
    const showExitCode = await runRenkuCli(
      [
        'cast',
        'voice',
        'show',
        '--project',
        'constantinople',
        '--cast',
        castMemberId,
        '--voice',
        'normal-voice',
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(showExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      voice: { id: attached.voice.id },
    });

    stdout = [];
    stderr = [];
    const removeExitCode = await runRenkuCli(
      [
        'cast',
        'voice',
        'remove',
        '--project',
        'constantinople',
        '--cast',
        castMemberId,
        '--voice',
        attached.voice.id,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(removeExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      removed: {
        voiceId: attached.voice.id,
        sampleAssetId: attached.voice.sample.assetId,
      },
    });
  });

  it('requires a reference name but only warns for a missing character sheet purpose', async () => {
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
    const castMemberId = project.cast[0]!.id;
    const sourcePath = 'generated/media/urban-sheet.png';
    await fs.mkdir(path.dirname(path.join(storageRoot, 'constantinople', sourcePath)), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(storageRoot, 'constantinople', sourcePath),
      'sheet bytes'
    );

    stdout = [];
    stderr = [];
    const missingNameExitCode = await runRenkuCli(
      [
        'media',
        'import',
        '--project',
        'constantinople',
        '--purpose',
        'cast.character-sheet',
        '--target',
        `cast:${castMemberId}`,
        '--source',
        sourcePath,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(missingNameExitCode).toBe(1);
    expect(JSON.parse(stderr.join('\n'))).toMatchObject({
      valid: false,
      error: { code: 'CLI001' },
    });

    stdout = [];
    stderr = [];
    const missingPurposeExitCode = await runRenkuCli(
      [
        'media',
        'import',
        '--project',
        'constantinople',
        '--purpose',
        'cast.character-sheet',
        '--target',
        `cast:${castMemberId}`,
        '--source',
        sourcePath,
        '--reference-name',
        'urban-palace-main',
        '--title',
        'Urban Palace Main Character Sheet',
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(missingPurposeExitCode).toBe(0);
    const imported = JSON.parse(stdout.join('\n'));
    expect(imported).toMatchObject({
      valid: true,
      imported: {
        referenceName: 'urban-palace-main',
        purpose: null,
        title: 'Urban Palace Main Character Sheet',
      },
      warnings: [
        {
          code: 'CLI045',
          severity: 'warning',
        },
      ],
    });

    stdout = [];
    stderr = [];
    const updateExitCode = await runRenkuCli(
      [
        'asset',
        'reference-update',
        imported.imported.assetId,
        '--project',
        'constantinople',
        '--target',
        `cast:${castMemberId}`,
        '--reference-name',
        'urban-siege-workshop-main',
        '--reference-purpose',
        'main workshop character sheet',
        '--title',
        'Urban Workshop Main Character Sheet',
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(updateExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      asset: {
        assetId: imported.imported.assetId,
        relationshipId: imported.imported.relationshipId,
        referenceName: 'urban-siege-workshop-main',
        purpose: 'main workshop character sheet',
        title: 'Urban Workshop Main Character Sheet',
      },
      warnings: [],
    });
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
      JSON.stringify(minimalScreenplayJson({ castMemberId: 'cast_missing', locationId: 'location_missing' }), null, 2),
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

  it('writes a scene shot list and imports storyboard images through the CLI', async () => {
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
    const castMemberId = project.cast[0]!.id;
    const locationId = project.locations[0]!.id;
    const shotListPath = path.join(homeDir, 'scene-shot-list.json');
    await fs.writeFile(
      shotListPath,
      JSON.stringify(
        {
          kind: 'sceneShotList',
          sceneId,
          title: 'Foundry coverage',
          summary: 'A one-shot coverage pass for Urban in the foundry.',
          coverageStrategy: 'Hold Urban and the bronze in one readable frame.',
          shots: [
            {
              shotId: 'shot_001',
              title: 'Urban studies the bronze',
              storyBeat: 'Urban studies the damaged material.',
              narrativePurpose: 'Establish attention and craft.',
              description: 'Wide static shot of Urban with the bronze.',
              shotType: 'wide',
              subject: 'Urban and the cracked bronze',
              action: 'Urban studies the cracked bronze.',
              dialogue: [],
              coveredBlockIndexes: [0],
              castMemberIds: [castMemberId],
              locationIds: [locationId],
            },
            {
              shotId: 'shot_002',
              title: 'Mara watches the crack',
              storyBeat: 'Mara notices the damage Urban does not want named.',
              narrativePurpose: 'Give the coverage a second selected storyboard panel.',
              description: 'Medium shot of Mara studying the cracked bronze.',
              shotType: 'medium',
              subject: 'Mara and the cracked bronze',
              action: 'Mara watches the crack in the bronze.',
              dialogue: [],
              coveredBlockIndexes: [0],
              castMemberIds: [castMemberId],
              locationIds: [locationId],
            },
          ],
        },
        null,
        2
      ),
      'utf8'
    );

    stdout = [];
    stderr = [];
    const writeExitCode = await runRenkuCli(
      ['screenplay', 'shot-list', 'write', '--file', shotListPath, '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(writeExitCode).toBe(0);
    const writeReport = JSON.parse(stdout.join('\n'));
    expect(writeReport).toMatchObject({
      valid: true,
      shotList: { sceneId, title: 'Foundry coverage' },
      activeShotListId: expect.any(String),
    });

    stdout = [];
    stderr = [];
    const contextExitCode = await runRenkuCli(
      [
        'screenplay',
        'shot-list',
        'context',
        '--scene',
        sceneId,
        '--include-visual-references',
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(contextExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      scene: { id: sceneId },
      activeShotList: { id: writeReport.activeShotListId },
    });

    stdout = [];
    stderr = [];
    const validateExitCode = await runRenkuCli(
      ['screenplay', 'shot-list', 'validate', '--file', shotListPath, '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(validateExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({ valid: true });

    const operationPath = path.join(homeDir, 'shot-list-operations.json');
    await fs.writeFile(
      operationPath,
      JSON.stringify(
        {
          kind: 'sceneShotListOperations',
          sceneId,
          baseShotListId: writeReport.activeShotListId,
          activate: false,
          title: 'Foundry coverage with insert',
          operations: [
            {
              operation: 'shots.insert',
              placement: { position: 'end' },
              shots: [
                {
                  shotId: 'shot_003',
                  title: 'The crack as evidence',
                  storyBeat: 'The material damage becomes undeniable.',
                  narrativePurpose: 'Add an insert that clarifies the object.',
                  description: 'Insert of the crack crossing the bronze surface.',
                  shotType: 'insert',
                  subject: 'The cracked bronze',
                  action: 'Light catches the crack.',
                  dialogue: [],
                  coveredBlockIndexes: [0],
                  castMemberIds: [castMemberId],
                  locationIds: [locationId],
                },
              ],
            },
          ],
        },
        null,
        2
      ),
      'utf8'
    );

    stdout = [];
    stderr = [];
    const validateOperationsExitCode = await runRenkuCli(
      [
        'screenplay',
        'shot-list',
        'validate-operations',
        '--file',
        operationPath,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(validateOperationsExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({ valid: true });

    stdout = [];
    stderr = [];
    const dryRunApplyExitCode = await runRenkuCli(
      [
        'screenplay',
        'shot-list',
        'apply',
        '--file',
        operationPath,
        '--dry-run',
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(dryRunApplyExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      baseShotListId: writeReport.activeShotListId,
      createdShotListId: `${writeReport.activeShotListId}_dry_run`,
    });

    stdout = [];
    stderr = [];
    const applyExitCode = await runRenkuCli(
      ['screenplay', 'shot-list', 'apply', '--file', operationPath, '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(applyExitCode).toBe(0);
    const applyReport = JSON.parse(stdout.join('\n'));
    expect(applyReport).toMatchObject({
      baseShotListId: writeReport.activeShotListId,
      createdShotListId: expect.any(String),
    });

    stdout = [];
    stderr = [];
    const storyboardStatusExitCode = await runRenkuCli(
      [
        'screenplay',
        'shot-list',
        'storyboard',
        'status',
        '--scene',
        sceneId,
        '--shot-list',
        applyReport.createdShotListId,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(storyboardStatusExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      shotListId: applyReport.createdShotListId,
      missingShotIds: expect.arrayContaining(['shot_003']),
    });

    stdout = [];
    stderr = [];
    const listExitCode = await runRenkuCli(
      ['screenplay', 'shot-list', 'list', '--scene', sceneId, '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(listExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      shotLists: expect.arrayContaining([
        expect.objectContaining({
          id: writeReport.activeShotListId,
          isActive: true,
        }),
      ]),
    });

    stdout = [];
    stderr = [];
    const showActiveExitCode = await runRenkuCli(
      [
        'screenplay',
        'shot-list',
        'show',
        '--active',
        '--scene',
        sceneId,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(showActiveExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      summary: { id: writeReport.activeShotListId },
      shotList: { title: 'Foundry coverage' },
    });

    stdout = [];
    stderr = [];
    const showByIdExitCode = await runRenkuCli(
      [
        'screenplay',
        'shot-list',
        'show',
        '--shot-list',
        writeReport.activeShotListId,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(showByIdExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      summary: { id: writeReport.activeShotListId },
    });

    stdout = [];
    stderr = [];
    const setActiveExitCode = await runRenkuCli(
      [
        'screenplay',
        'shot-list',
        'set-active',
        '--scene',
        sceneId,
        '--shot-list',
        writeReport.activeShotListId,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(setActiveExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      activeShotListId: writeReport.activeShotListId,
    });

    const storyboardLookbookPath = path.join(homeDir, 'storyboard-lookbook.json');
    await fs.writeFile(
      storyboardLookbookPath,
      JSON.stringify(storyboardLookbookJson(), null, 2),
      'utf8'
    );
    stdout = [];
    stderr = [];
    const createStoryboardLookbookExitCode = await runRenkuCli(
      [
        'lookbook',
        'create',
        '--file',
        storyboardLookbookPath,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(createStoryboardLookbookExitCode).toBe(0);
    const storyboardLookbookReport = JSON.parse(stdout.join('\n'));

    stdout = [];
    stderr = [];
    const selectStoryboardLookbookExitCode = await runRenkuCli(
      [
        'lookbook',
        'select',
        '--type',
        'storyboard',
        '--lookbook',
        storyboardLookbookReport.lookbook.id,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(selectStoryboardLookbookExitCode).toBe(0);

    const storyboardLookbookSheetPath =
      'generated/media/graphite-storyboard-lookbook-sheet.png';
    await fs.mkdir(
      path.dirname(path.join(storageRoot, 'constantinople', storyboardLookbookSheetPath)),
      { recursive: true }
    );
    await fs.writeFile(
      path.join(storageRoot, 'constantinople', storyboardLookbookSheetPath),
      'storyboard sheet bytes'
    );
    stdout = [];
    stderr = [];
    const storyboardSheetImportExitCode = await runRenkuCli(
      [
        'media',
        'import',
        '--purpose',
        'lookbook.sheet',
        '--target',
        `lookbook:${storyboardLookbookReport.lookbook.id}`,
        '--source',
        storyboardLookbookSheetPath,
        '--title',
        'Graphite Storyboard sheet',
        '--summary',
        'Storyboard style reference guide.',
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(storyboardSheetImportExitCode).toBe(0);

    stdout = [];
    stderr = [];
    const generationContextExitCode = await runRenkuCli(
      [
        'generation',
        'context',
        '--purpose',
        'scene.storyboard-sheet',
        '--target',
        `scene:${sceneId}`,
        '--shot-list',
        writeReport.activeShotListId,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(generationContextExitCode, stderr.join('\n') + stdout.join('\n')).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      purpose: 'scene.storyboard-sheet',
      shotListId: writeReport.activeShotListId,
      defaults: {
        sheetFrame: '4:3',
        shotFrame: 'project',
        resolvedShotFrame: '16:9',
        maxShotsPerSheet: 4,
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
        'scene.storyboard-sheet',
        '--target',
        `scene:${sceneId}`,
        '--shot-list',
        writeReport.activeShotListId,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(modelListExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      models: expect.arrayContaining([
        expect.objectContaining({ modelChoice: 'fal-ai/nano-banana-2' }),
      ]),
    });

    const shotProductionPath = path.join(homeDir, 'shot-video-production.json');
    await fs.writeFile(
      shotProductionPath,
      JSON.stringify(
        {
          inputModeId: 'text-only',
          modelChoice: 'fal-ai/bytedance/seedance-2.0',
          parameterValues: {},
        },
        null,
        2
      ),
      'utf8'
    );

    stdout = [];
    stderr = [];
    const takeCreateExitCode = await runRenkuCli(
      [
        'take',
        'create',
        '--scene',
        sceneId,
        '--shot-list',
        writeReport.activeShotListId,
        '--shots',
        'shot_001',
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(takeCreateExitCode, stderr.join('\n') + stdout.join('\n')).toBe(0);
    const take = JSON.parse(stdout.join('\n')) as {
      takeId: string;
    };

    stdout = [];
    stderr = [];
    const publicTakeListExitCode = await runRenkuCli(
      ['take', 'list', '--scene', sceneId, '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(publicTakeListExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      takes: expect.arrayContaining([
        expect.objectContaining({
          takeId: take.takeId,
        }),
      ]),
    });

    stdout = [];
    stderr = [];
    const publicTakeShowExitCode = await runRenkuCli(
      ['take', 'show', '--take', take.takeId, '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(publicTakeShowExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      takeId: take.takeId,
      state: {
        version: 1,
      },
    });

    stdout = [];
    stderr = [];
    const productionUpdateExitCode = await runRenkuCli(
      [
        'generation',
        'production',
        'update',
        '--purpose',
        'shot.video-take',
        '--target',
        `scene:${sceneId}`,
        '--take',
        take.takeId,
        '--file',
        shotProductionPath,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(productionUpdateExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      target: {
        takeId: take.takeId,
        shotIds: ['shot_001'],
      },
    });

    stdout = [];
    stderr = [];
    const wrongSceneProductionUpdateExitCode = await runRenkuCli(
      [
        'generation',
        'production',
        'update',
        '--purpose',
        'shot.video-take',
        '--target',
        'scene:scene_wrong',
        '--take',
        take.takeId,
        '--file',
        shotProductionPath,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(wrongSceneProductionUpdateExitCode).toBe(1);
    expect(stderr.join('\n')).toContain('PROJECT_DATA423');

    stdout = [];
    stderr = [];
    const shotContextExitCode = await runRenkuCli(
      [
        'generation',
        'context',
        '--purpose',
        'shot.video-take',
        '--target',
        `scene:${sceneId}`,
        '--take',
        take.takeId,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(shotContextExitCode).toBe(0);
    const shotContext = JSON.parse(stdout.join('\n'));
    expect(shotContext).toMatchObject({
      target: {
        sceneId,
        takeId: take.takeId,
        shotIds: ['shot_001'],
      },
      take: {
        takeId: take.takeId,
      },
    });

    stdout = [];
    stderr = [];
    const wrongSceneContextExitCode = await runRenkuCli(
      [
        'generation',
        'context',
        '--purpose',
        'shot.video-take',
        '--target',
        'scene:scene_wrong',
        '--take',
        take.takeId,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(wrongSceneContextExitCode).toBe(1);
    expect(stderr.join('\n')).toContain('PROJECT_DATA423');

    stdout = [];
    stderr = [];
    const shotPlanExitCode = await runRenkuCli(
      [
        'generation',
        'plan',
        '--purpose',
        'shot.video-take',
        '--target',
        `scene:${sceneId}`,
        '--take',
        take.takeId,
        '--intent',
        'text-only',
        '--model',
        'fal-ai/bytedance/seedance-2.0',
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(shotPlanExitCode, stderr.join('\n') + stdout.join('\n')).toBe(0);
    const shotPlanJson = stdout.join('\n');
    expect(shotPlanJson).toContain('shot.video-take');
    expect(shotPlanJson).toContain(take.takeId);

    stdout = [];
    stderr = [];
    const shotInputModelListExitCode = await runRenkuCli(
      [
        'generation',
        'model',
        'list',
        '--purpose',
        'shot.first-frame',
        '--target',
        `scene:${sceneId}`,
        '--take',
        take.takeId,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(shotInputModelListExitCode).toBe(0);
    const shotInputModels = JSON.parse(stdout.join('\n'));
    expect(shotInputModels).toMatchObject({
      purpose: 'shot.first-frame',
      defaultModelChoice: 'fal-ai/openai/gpt-image-2',
      target: {
        takeId: take.takeId,
      },
      models: expect.arrayContaining([
        expect.objectContaining({ modelChoice: 'fal-ai/openai/gpt-image-2' }),
        expect.objectContaining({ modelChoice: 'fal-ai/nano-banana-2' }),
        expect.objectContaining({ modelChoice: 'fal-ai/xai/grok-imagine-image' }),
      ]),
    });
    expect(
      shotInputModels.models.some(
        (model: { modelChoice: string }) =>
          model.modelChoice === 'fal-ai/bytedance/seedance-2.0'
      )
    ).toBe(false);

    const shotFirstFrameSpecPath = path.join(homeDir, 'shot-first-frame-spec.json');
    await fs.writeFile(
      shotFirstFrameSpecPath,
      JSON.stringify(
        {
          purpose: 'shot.first-frame',
          target: shotInputModels.target,
          dependencyKind: 'first-frame',
          outputInputKind: 'first-frame',
          modelChoice: shotInputModels.defaultModelChoice,
          prompt: 'A still first frame for Urban studying the bronze.',
          parameterValues: shotInputModels.models[0].defaultParameterValues,
          title: 'Foundry first frame',
        },
        null,
        2
      ),
      'utf8'
    );

    stdout = [];
    stderr = [];
    const shotFirstFrameValidateExitCode = await runRenkuCli(
      ['generation', 'spec', 'validate', '--file', shotFirstFrameSpecPath, '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(shotFirstFrameValidateExitCode, stderr.join('\n') + stdout.join('\n')).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      valid: true,
      spec: {
        purpose: 'shot.first-frame',
        modelChoice: 'fal-ai/openai/gpt-image-2',
      },
    });

    const specPath = path.join(homeDir, 'scene-storyboard-spec.json');
    await fs.writeFile(
      specPath,
      JSON.stringify(
        {
          purpose: 'scene.storyboard-sheet',
          target: { kind: 'scene', id: sceneId },
          shotListId: writeReport.activeShotListId,
          shotIds: ['shot_001'],
          modelChoice: 'fal-ai/nano-banana-2',
          prompt: 'A clean charcoal pencil storyboard sheet for this scene.',
          takeCount: 1,
          seed: null,
          sheetFrame: '4:3',
          shotFrame: 'project',
          detail: 'standard',
          outputFormat: 'png',
          title: 'Foundry storyboard sheet',
        },
        null,
        2
      ),
      'utf8'
    );

    stdout = [];
    stderr = [];
    const specValidateExitCode = await runRenkuCli(
      ['generation', 'spec', 'validate', '--file', specPath, '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(specValidateExitCode, stderr.join('\n') + stdout.join('\n')).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      valid: true,
      spec: { purpose: 'scene.storyboard-sheet' },
    });

    stdout = [];
    stderr = [];
    const specCreateExitCode = await runRenkuCli(
      ['generation', 'spec', 'create', '--file', specPath, '--json'],
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
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      estimate: { approvalToken: expect.stringMatching(/^sha256:/) },
    });

    stdout = [];
    stderr = [];
    const runExitCode = await runRenkuCli(
      ['generation', 'run', '--spec', createdSpec.id, '--simulate', '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(runExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      run: { simulated: true },
    });

    const importPath = path.join(homeDir, 'scene-storyboard-import.json');
    await fs.mkdir(path.join(storageRoot, 'constantinople', 'generated/media'), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(storageRoot, 'constantinople', 'generated/media/shot.png'),
      'shot'
    );
    await fs.writeFile(
      importPath,
      JSON.stringify(
        {
          kind: 'sceneStoryboardImagesImport',
          shotListId: writeReport.activeShotListId,
          shots: [{ shotId: 'shot_001', source: 'generated/media/shot.png' }],
        },
        null,
        2
      ),
      'utf8'
    );

    stdout = [];
    stderr = [];
    const importExitCode = await runRenkuCli(
      [
        'media',
        'import',
        '--purpose',
        'scene.storyboard-sheet',
        '--target',
        `scene:${sceneId}`,
        '--shot-list',
        writeReport.activeShotListId,
        '--file',
        importPath,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(importExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      purpose: 'scene.storyboard-sheet',
      storyboardImageIds: [expect.any(String)],
      imported: [expect.objectContaining({ type: 'scene_storyboard_image' })],
      files: [
        expect.objectContaining({
          role: 'storyboard_image',
          shotId: 'shot_001',
        }),
      ],
    });

    const multiImportPath = path.join(homeDir, 'scene-storyboard-multi-import.json');
    for (const filename of ['shot-1.png', 'shot-2.png']) {
      await fs.writeFile(
        path.join(storageRoot, 'constantinople', `generated/media/${filename}`),
        filename
      );
    }
    await fs.writeFile(
      multiImportPath,
      JSON.stringify(
        {
          kind: 'sceneStoryboardImagesImport',
          shotListId: writeReport.activeShotListId,
          title: 'Foundry grouped storyboard',
          shots: [
            { shotId: 'shot_001', source: 'generated/media/shot-1.png' },
            { shotId: 'shot_002', source: 'generated/media/shot-2.png' },
          ],
        },
        null,
        2
      ),
      'utf8'
    );

    stdout = [];
    stderr = [];
    const multiImportExitCode = await runRenkuCli(
      [
        'media',
        'import',
        '--purpose',
        'scene.storyboard-sheet',
        '--target',
        `scene:${sceneId}`,
        '--shot-list',
        writeReport.activeShotListId,
        '--file',
        multiImportPath,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(multiImportExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      purpose: 'scene.storyboard-sheet',
      storyboardImageIds: [expect.any(String), expect.any(String)],
      imported: [
        expect.objectContaining({ type: 'scene_storyboard_image' }),
        expect.objectContaining({ type: 'scene_storyboard_image' }),
      ],
      files: expect.arrayContaining([
        expect.objectContaining({ role: 'storyboard_image', shotId: 'shot_001' }),
        expect.objectContaining({ role: 'storyboard_image', shotId: 'shot_002' }),
      ]),
    });
  });

  it('reports current scene shot tab focus through studio current', async () => {
    await initializeStorageRoot();
    const createExitCode = await createProject();
    if (isMissingSqliteBindings(createExitCode, stderr)) {
      return;
    }
    await openProjectAndCreateScreenplay();

    const projectData = createProjectDataService();
    const screenplay = await projectData.readScreenplay({ homeDir });
    const scene = screenplay.screenplay!.acts[0]!.sequences[0]!.scenes[0]!;
    const castMember = screenplay.screenplay!.cast[0]!;
    const location = screenplay.screenplay!.locations[0]!;
    const writtenShotList = await projectData.writeSceneShotList({
      homeDir,
      document: {
        kind: 'sceneShotList',
        sceneId: scene.id as string,
        title: 'Opening coverage',
        summary: 'A focused first shot.',
        coverageStrategy: 'Hold one readable setup.',
        shots: [
          {
            shotId: 'shot_001',
            title: 'Urban studies the bronze',
            storyBeat: 'Urban reads the cannon before anyone else does.',
            narrativePurpose: 'Show expertise before consequence.',
            description: 'Urban leans close to the bronze seam.',
            shotType: 'Medium Close-Up',
            subject: 'Urban and the bronze cannon',
            action: 'Urban studies the metal in silence.',
            dialogue: [],
            coveredBlockIndexes: [0],
            castMemberIds: [castMember.id as string],
            locationIds: [location.id as string],
          },
        ],
      },
    });
    const take = await projectData.createSceneShotVideoTake({
      homeDir,
      sceneId: scene.id as string,
      shotListId: writtenShotList.shotList.id,
      shotIds: ['shot_001'],
    });
    await projectData.updateSceneShotVideoTakeShotDesign({
      homeDir,
      takeId: take.takeId,
      shotId: 'shot_001',
      shotDesign: {
        composition: {
          shotSize: 'medium-close-up',
          subjectFraming: ['single'],
          cameraAngle: 'low-angle',
        },
      },
    });
    const project = await projectData.readProject({
      homeDir,
      projectName: 'constantinople',
    });
    const coordination = createStudioCoordinationService({ homeDir });
    const now = new Date();
    await claimStudioRuntimeDescriptor({
      homeDir,
      host: '127.0.0.1',
      port: 5173,
      serverUrl: 'http://127.0.0.1:5173',
      now,
    });
    await coordination.appendStudioEvent({
      type: 'studio.browserSessionActive',
      browserSessionId: 'studio_browser_test',
      source: { kind: 'studio', browserSessionId: 'studio_browser_test' },
      createdAt: now.toISOString(),
    });
    await coordination.appendStudioEvent({
      type: 'studio.focusChanged',
      projectRef: {
        name: project.identity.name,
        id: project.identity.id,
        storageRoot: path.join(homeDir, 'movies'),
      },
      focus: {
        screen: 'movieStudio',
        selection: {
          type: 'scene',
          id: scene.id as string,
          sceneTab: 'takes',
          takeWorkspaceMode: 'edit',
          takeId: take.takeId,
          shotId: 'shot_001',
          shotTab: 'composition',
        },
      },
      source: { kind: 'studio', browserSessionId: 'studio_browser_test' },
      createdAt: now.toISOString(),
    });

    stdout = [];
    stderr = [];
    const jsonExitCode = await runRenkuCli(['studio', 'current', '--json'], {
      homeDir,
      io: captureIo(stdout, stderr),
    });

    expect(jsonExitCode).toBe(0);
    const current = JSON.parse(stdout.join('\n'));
    expect(current.selection).toMatchObject({
      type: 'scene',
      sceneTab: 'takes',
      takeWorkspaceMode: 'edit',
      takeId: take.takeId,
      shotId: 'shot_001',
      shotTab: 'composition',
    });
    expect(current.context).toMatchObject({
      kind: 'scene',
      sceneTab: { id: 'takes', label: 'Takes' },
      shot: {
        id: 'shot_001',
        activeTab: { id: 'composition', label: 'Composition' },
        currentTabSelections: {
          kind: 'composition',
          shotSize: { id: 'medium-close-up', label: 'Medium Close-Up' },
          subjectFraming: [{ id: 'single', label: 'Single' }],
          cameraAngle: { id: 'low-angle', label: 'Low Angle' },
        },
      },
    });

    stdout = [];
    stderr = [];
    const textExitCode = await runRenkuCli(['studio', 'current'], {
      homeDir,
      io: captureIo(stdout, stderr),
    });

    expect(textExitCode).toBe(0);
    expect(stdout).toContain('Current Studio project: constantinople');
    expect(stdout).toContain(
      `Focus: Scene ${scene.title} > Takes > Shot 1 > Composition`
    );
    expect(stderr).toEqual([]);
  });

  it('reports missing Studio dev server status for agents', async () => {
    const exitCode = await runRenkuCli(
      ['studio', 'server', 'status', '--json'],
      {
        homeDir,
        io: captureIo(stdout, stderr),
      }
    );

    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      server: {
        running: false,
        canonicalUrl: 'http://localhost:5173',
        descriptor: {
          present: false,
          fresh: false,
          matchesCanonical: false,
          hasCliNotificationToken: false,
        },
      },
      eventStore: {
        path: '~/.config/renku/studio-events.jsonl',
        lineCount: 0,
        invalidEventCount: 0,
        warningCount: 0,
      },
      agent: {
        serverPolicy: 'attachOnly',
        browserUrl: 'http://localhost:5173',
        browserAccess: {
          requiredSurface: 'inAppBrowser',
          accessMethod: 'browserClientBootstrap',
          requiredTool: 'mcp__node_repl__js',
          directBrowserToolRequired: false,
        },
      },
    });
    expect(stderr).toEqual([]);
  });

  it('reports fresh canonical Studio dev server status without exposing tokens', async () => {
    await claimStudioRuntimeDescriptor({
      homeDir,
      host: 'localhost',
      port: 5173,
      serverUrl: 'http://localhost:5173',
      cliNotificationToken: 'notification-token-test',
    });
    const eventStorePath = resolveStudioEventStorePath({ homeDir });
    await fs.mkdir(path.dirname(eventStorePath), { recursive: true });
    await fs.writeFile(
      eventStorePath,
      [
        JSON.stringify({
          id: 'studio_event_unsupported',
          version: '0.1.0',
          createdAt: new Date().toISOString(),
          type: 'studio.focusChanged',
          projectRef: {
            name: 'constantinople',
            id: 'project_test0001',
            storageRoot: path.join(homeDir, 'movies'),
          },
          focus: {
            screen: 'movieStudio',
            selection: { type: 'storyboard' },
          },
          source: {
            kind: 'studio',
            browserSessionId: 'studio_browser_test',
          },
        }),
        '',
      ].join('\n'),
      'utf8'
    );

    const exitCode = await runRenkuCli(
      ['studio', 'server', 'status', '--json'],
      {
        homeDir,
        io: captureIo(stdout, stderr),
      }
    );

    const output = stdout.join('\n');
    expect(exitCode).toBe(0);
    expect(output).not.toContain('notification-token-test');
    expect(JSON.parse(output)).toMatchObject({
      server: {
        running: true,
        canonicalUrl: 'http://localhost:5173',
        descriptor: {
          present: true,
          fresh: true,
          host: 'localhost',
          port: 5173,
          serverUrl: 'http://localhost:5173',
          hasCliNotificationToken: true,
          matchesCanonical: true,
        },
      },
      eventStore: {
        lineCount: 1,
        invalidEventCount: 1,
        warningCount: 1,
      },
      agent: {
        serverPolicy: 'attachOnly',
        browserUrl: 'http://localhost:5173',
        browserAccess: {
          requiredSurface: 'inAppBrowser',
          accessMethod: 'browserClientBootstrap',
          requiredTool: 'mcp__node_repl__js',
          directBrowserToolRequired: false,
        },
      },
    });
    expect(stderr).toEqual([]);
  });

  it('reports stale Studio dev server descriptors', async () => {
    await claimStudioRuntimeDescriptor({
      homeDir,
      host: 'localhost',
      port: 5173,
      serverUrl: 'http://localhost:5173',
      cliNotificationToken: 'notification-token-test',
      now: new Date('2000-01-01T00:00:00.000Z'),
    });

    const exitCode = await runRenkuCli(
      ['studio', 'server', 'status', '--json'],
      {
        homeDir,
        io: captureIo(stdout, stderr),
      }
    );

    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      server: {
        running: false,
        descriptor: {
          present: true,
          fresh: false,
          matchesCanonical: true,
        },
      },
    });
    expect(stderr).toEqual([]);
  });

  it('reports fresh descriptors with dead processes as not running', async () => {
    const descriptorPath = resolveStudioRuntimeDescriptorPath({ homeDir });
    const now = new Date();
    await fs.mkdir(path.dirname(descriptorPath), { recursive: true });
    await fs.writeFile(
      descriptorPath,
      JSON.stringify(
        {
          version: '0.1.0',
          serverInstanceId: 'studio_server_dead_process',
          pid: 0,
          host: 'localhost',
          port: 5173,
          serverUrl: 'http://localhost:5173',
          startedAt: now.toISOString(),
          heartbeatAt: now.toISOString(),
          cliNotificationToken: 'notification-token-test',
        },
        null,
        2
      ),
      'utf8'
    );

    const exitCode = await runRenkuCli(
      ['studio', 'server', 'status', '--json'],
      {
        homeDir,
        io: captureIo(stdout, stderr),
      }
    );

    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      server: {
        running: false,
        descriptor: {
          present: true,
          fresh: false,
          matchesCanonical: true,
        },
      },
    });
    expect(stderr).toEqual([]);
  });

  it('reports fresh non-canonical Studio dev server descriptors', async () => {
    await claimStudioRuntimeDescriptor({
      homeDir,
      host: 'localhost',
      port: 5174,
      serverUrl: 'http://localhost:5174',
      cliNotificationToken: 'notification-token-test',
    });

    const exitCode = await runRenkuCli(
      ['studio', 'server', 'status', '--json'],
      {
        homeDir,
        io: captureIo(stdout, stderr),
      }
    );

    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      server: {
        running: true,
        canonicalUrl: 'http://localhost:5173',
        descriptor: {
          present: true,
          fresh: true,
          host: 'localhost',
          port: 5174,
          serverUrl: 'http://localhost:5174',
          matchesCanonical: false,
        },
      },
    });
    expect(stderr).toEqual([]);
  });

  it('prints JSON for director context on the current authoring project', async () => {
    await initializeStorageRoot();
    const createExitCode = await createProject();
    if (isMissingSqliteBindings(createExitCode, stderr)) {
      return;
    }
    expect(createExitCode).toBe(0);

    stdout = [];
    stderr = [];
    const directorExitCode = await runRenkuCli(
      ['director', 'context', '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );

    expect(directorExitCode).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toMatchObject({
      valid: true,
      project: {
        name: 'constantinople',
        title: 'Preparation of the Siege',
      },
      screenplay: { exists: false },
      nextSteps: [expect.objectContaining({ id: 'draft-screenplay' })],
      diagnostics: [expect.objectContaining({ code: 'DIRECTOR_CONTEXT002' })],
    });
    expect(stderr).toEqual([]);
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

  async function seedCliFacts(): Promise<{ castMemberId: string; locationId: string }> {
    const castPath = path.join(homeDir, 'cast-operations.json');
    await fs.writeFile(
      castPath,
      JSON.stringify(
        {
          kind: 'castOperations',
          operations: [
            {
              operation: 'castMember.add',
              castMember: {
                key: 'urban',
                handle: 'urban',
                name: 'Urban',
              },
            },
          ],
        },
        null,
        2
      ),
      'utf8'
    );
    stdout = [];
    stderr = [];
    const castExitCode = await runRenkuCli(
      ['cast', 'apply', '--file', castPath, '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(castExitCode).toBe(0);
    const castMemberId = JSON.parse(stdout.join('\n')).generatedIds[0].id as string;

    const locationPath = path.join(homeDir, 'location-operations.json');
    await fs.writeFile(
      locationPath,
      JSON.stringify(
        {
          kind: 'locationOperations',
          operations: [
            {
              operation: 'location.add',
              location: {
                key: 'foundry',
                handle: 'foundry',
                name: 'Foundry',
              },
            },
          ],
        },
        null,
        2
      ),
      'utf8'
    );
    stdout = [];
    stderr = [];
    const locationExitCode = await runRenkuCli(
      ['location', 'apply', '--file', locationPath, '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(locationExitCode).toBe(0);
    const locationId = JSON.parse(stdout.join('\n')).generatedIds[0].id as string;

    return { castMemberId, locationId };
  }

  async function openProjectAndCreateScreenplay(): Promise<void> {
    stdout = [];
    stderr = [];
    const openExitCode = await runRenkuCli(
      ['project', 'open', 'constantinople', '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(openExitCode).toBe(0);

    const facts = await seedCliFacts();
    const screenplayPath = path.join(homeDir, 'screenplay.json');
    await fs.writeFile(
      screenplayPath,
      JSON.stringify(minimalScreenplayJson(facts), null, 2),
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

function minimalScreenplayJson(input: { castMemberId: string; locationId: string }) {
  return {
    kind: 'screenplayCreate',
    screenplay: {
      title: 'Urban Basilica',
    },
    cast: [],
    locations: [],
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
                  locationIds: [input.locationId],
                },
                blocks: [
                  {
                    type: 'action',
                    text: 'Urban studies the cracked bronze.',
                    castMemberIds: [input.castMemberId],
                    locationIds: [input.locationId],
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

function threeActScreenplayJson(input: { castMemberId: string; locationId: string }) {
  return {
    kind: 'screenplayCreate',
    screenplay: {
      title: 'Urban Basilica',
      logline: 'A founder builds a weapon and a conscience.',
      summary: 'Urban sells his craft and must face what it makes possible.',
      dramaticQuestion: 'Can Urban understand responsibility before the walls fall?',
      themes: ['craft and complicity'],
      tone: ['grave', 'precise'],
      genrePrimary: 'historical drama',
    },
    cast: [],
    locations: [],
    acts: [
      cliScreenplayAct(input, 'act-one', 'The Offer', 'commission', 'The Refusal'),
      cliScreenplayAct(input, 'act-two', 'The Patron', 'casting', 'The Bargain'),
      cliScreenplayAct(input, 'act-three', 'The Sound', 'siege', 'The Wall Answers'),
    ],
  };
}

function cliScreenplayAct(
  input: { castMemberId: string; locationId: string },
  actKey: string,
  actTitle: string,
  sequenceKey: string,
  sceneTitle: string
) {
  return {
    key: actKey,
    title: actTitle,
    purpose: 'Move Urban through the moral cost of his craft.',
    sequences: [
      {
        key: sequenceKey,
        title: sceneTitle,
        purpose: 'Pressure Urban toward a choice.',
        scenes: [
          {
            key: `${sequenceKey}-scene`,
            title: sceneTitle,
            setting: {
              interiorExterior: 'INT',
              timeOfDay: 'NIGHT',
              locationIds: [input.locationId],
            },
            storyFunction: ['Pressure Urban'],
            blocks: [
              {
                type: 'action',
                text: 'Urban studies the cracked bronze and hears the city waiting.',
                castMemberIds: [input.castMemberId],
                locationIds: [input.locationId],
              },
            ],
          },
        ],
      },
    ],
  };
}

function screenplayAnalysisJson(context: {
  screenplay: {
    acts: Array<{
      id: string;
      title: string;
      sequences: Array<{
        id: string;
        title: string;
        scenes: Array<{ id: string; title: string }>;
      }>;
    }>;
  };
}) {
  const acts = context.screenplay.acts;
  const sequences = acts.map((act) => act.sequences[0]);
  const scenes = sequences.map((sequence) => sequence?.scenes[0]);
  return {
    kind: 'screenplayAnalysis',
    structureModel: 'threeAct',
    title: 'Three-act screenplay analysis',
    summary:
      'Urban has a clear moral engine, but the opening can sharpen agency.',
    criteria: [
      {
        key: 'dramaticEnergy',
        label: 'Dramatic Energy',
        description: 'How strongly the moment pulls the audience forward.',
      },
      {
        key: 'stakes',
        label: 'Stakes',
        description:
          'How clearly the audience understands what can be lost or gained.',
      },
      {
        key: 'characterAgency',
        label: 'Character Agency',
        description: "How clearly a character's choice drives the story.",
      },
    ],
    acts: acts.map((act, index) => ({
      actId: act.id,
      actRole: ['actOne', 'actTwo', 'actThree'][index],
      title: act.title,
      synopsis: 'The act presents pressure and moral consequence.',
      scoreByCriterion: {
        dramaticEnergy: 60,
        stakes: 55,
        characterAgency: 50,
      },
      critique: cliUsefulCritique(scenes[index]?.id),
    })),
    keyBeats: [
      {
        key: 'hook',
        label: 'Hook',
        actId: acts[0]?.id,
        sequenceId: sequences[0]?.id,
        sceneId: scenes[0]?.id,
        synopsis: 'The story opens with the cost of Urban refusing limits.',
        scoreByCriterion: {
          dramaticEnergy: 70,
          stakes: 65,
          characterAgency: 55,
        },
        critique: cliUsefulCritique(scenes[0]?.id),
      },
    ],
    sequences: sequences.map((sequence, index) => ({
      sequenceId: sequence?.id,
      actId: acts[index]?.id,
      title: sequence?.title,
      synopsis: 'The sequence advances pressure on Urban.',
      beatRole: index === 0 ? 'hook' : undefined,
      scoreByCriterion: {
        dramaticEnergy: 60,
        stakes: 58,
        characterAgency: 53,
      },
      critique: cliUsefulCritique(scenes[index]?.id),
    })),
    scenes: scenes.map((scene, index) => ({
      sceneId: scene?.id,
      sequenceId: sequences[index]?.id,
      actId: acts[index]?.id,
      title: scene?.title,
      synopsis: 'The scene shows Urban under pressure.',
      beatRole: index === 0 ? 'hook' : undefined,
      scoreByCriterion: {
        dramaticEnergy: 64,
        stakes: 59,
        characterAgency: 51,
      },
      critique: cliUsefulCritique(scene?.id),
    })),
    suggestedSceneAdditions: [
      {
        targetActId: acts[0]?.id,
        targetSequenceId: sequences[0]?.id,
        placement: { afterSceneId: scenes[0]?.id },
        title: 'The Maker Calculates',
        purpose: 'Give Urban a clearer active choice after the hook.',
        synopsis:
          'Urban privately weighs whether his craft can survive without patronage.',
        rationale:
          'The added beat would make the hook personal instead of only situational.',
        expectedCriterionChanges: [
          {
            criterionKey: 'characterAgency',
            direction: 'increase',
            reason: 'The audience sees Urban choose pressure.',
          },
        ],
      },
    ],
  };
}

function cliUsefulCritique(sceneId?: string) {
  return {
    summary: 'The dramatic pressure is clear, but the choice can be sharper.',
    strengths: ['The scene gives the audience concrete pressure.'],
    concerns: ['Urban reacts before the audience fully sees his want.'],
    evidence: [
      {
        sceneId,
        text: 'The scene emphasizes pressure before a fully active decision.',
      },
    ],
    suggestions: ['Make the decision point more visible on the page.'],
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
    kind: 'movieLookbook',
    movieLookbook: {
      name: 'Contaminated Tenderness',
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
            id: 'composition-clinical-symmetry',
            name: 'Clinical symmetry',
            description: 'Use centered frames when a body becomes an argument.',
          },
        ],
      },
      lighting: {
        description: 'High-key institutional light breaks into colored threat.',
        patterns: [
          {
            id: 'lighting-contaminated-practicals',
            name: 'Contaminated practicals',
            description: 'Let green sources corrupt otherwise clean environments.',
          },
        ],
      },
      texture: {
        description: 'Skin, gloss, condensation, and plastic carry the image.',
        observations: [
          {
            id: 'texture-biological-clean-rooms',
            text: 'Texture should make clean rooms feel biological.',
          },
        ],
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

function storyboardLookbookJson() {
  return {
    kind: 'storyboardLookbook',
    storyboardLookbook: {
      name: 'Graphite Storyboard',
      styleBrief: { text: 'Graphite storyboard frames with clear staging.' },
      lineAndFinish: { text: 'Loose pencil construction with crisp ink accents.' },
      valueAndAccent: { text: 'Soft gray values with restrained warm accents.' },
      guardrails: { text: 'Avoid photoreal stills and decorative text inside panels.' },
    },
    sourceMovieLookbookIds: [],
    sourceInspirationFolderIds: [],
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
