import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createProjectDataService,
  createStudioCoordinationService,
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

    const screenplayPath = path.join(homeDir, 'screenplay-three-act.json');
    await fs.writeFile(
      screenplayPath,
      JSON.stringify(threeActScreenplayJson(), null, 2),
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

    stdout = [];
    stderr = [];
    await expect(
      createStudioCoordinationService({ homeDir }).readStudioEvents()
    ).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          type: 'studio.projectResourcesChanged',
          resourceKeys: expect.arrayContaining([
            'surface:story-arc',
            `screenplay-analysis:${writeReport.analysis.id}`,
          ]),
        }),
      ]),
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
    await openProjectAndCreateScreenplay();

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
    const setActiveLookbookExitCode = await runRenkuCli(
      ['lookbook', 'set-active', '--lookbook', report.lookbook.id, '--json'],
      { homeDir, io: captureIo(stdout, stderr) }
    );
    expect(setActiveLookbookExitCode).toBe(0);

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
    await expect(
      createStudioCoordinationService({ homeDir }).readStudioEvents()
    ).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          type: 'studio.projectResourcesChanged',
          resourceKeys: mediaImportReport.resourceKeys,
          source: { kind: 'cli', command: 'media import' },
        }),
      ]),
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

function threeActScreenplayJson() {
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
      cliScreenplayAct('act-one', 'The Offer', 'commission', 'The Refusal'),
      cliScreenplayAct('act-two', 'The Patron', 'casting', 'The Bargain'),
      cliScreenplayAct('act-three', 'The Sound', 'siege', 'The Wall Answers'),
    ],
  };
}

function cliScreenplayAct(
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
              locationReferences: [{ key: 'foundry' }],
            },
            storyFunction: ['Pressure Urban'],
            blocks: [
              {
                type: 'action',
                text: 'Urban studies the cracked bronze and hears the city waiting.',
                castMemberReferences: [{ key: 'urban' }],
                locationReferences: [{ key: 'foundry' }],
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
