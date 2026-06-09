import {
  StructuredError,
  createDiagnosticError,
} from '@gorenku/studio-diagnostics';
import {
  createProjectDataService,
  createStudioCoordinationService,
  createStudioOperationId,
  resolveRenkuStorageRoot,
} from '@gorenku/studio-core/server';
import { formatDiagnosticIssue, type RenkuCliIo } from '../cli.js';

export interface RunCreateCommandOptions {
  input: string[];
  file?: string;
  title?: string;
  aspectRatio?: string;
  logline?: string;
  summary?: string;
  storageRoot?: string;
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}

export async function runCreateCommand(
  options: RunCreateCommandOptions
): Promise<number> {
  if (options.file) {
    throw new StructuredError({
      code: 'CLI001',
      message: 'Project creation does not accept --file.',
      issues: [
        createDiagnosticError(
          'CLI001',
          '--file is not valid for project creation.',
          { path: ['--file'], context: 'renku CLI arguments' },
          'Use `renku create <project-name> --title <title>`.'
        ),
      ],
    });
  }

  if (options.input.length === 0) {
    throw new StructuredError({
      code: 'CLI002',
      message:
        'Missing required project name. Usage: renku create <project-name> --title <title>',
      issues: [
        createDiagnosticError(
          'CLI002',
          'Missing required project name.',
          { path: ['create'], context: 'renku CLI arguments' },
          'Run `renku create <project-name> --title <title>`.'
        ),
      ],
    });
  }

  if (options.input.length > 1) {
    throw new StructuredError({
      code: 'CLI003',
      message: 'Create accepts exactly one project name.',
      issues: [
        createDiagnosticError(
          'CLI003',
          'Too many positional project names.',
          { path: ['create'], context: 'renku CLI arguments' },
          'Pass one project folder name.'
        ),
      ],
    });
  }

  if (!options.title) {
    throw new StructuredError({
      code: 'CLI004',
      message: 'Missing required --title. Usage: renku create <project-name> --title <title>',
      issues: [
        createDiagnosticError(
          'CLI004',
          'Missing required --title.',
          { path: ['--title'], context: 'renku CLI arguments' },
          'Pass the human-readable movie title.'
        ),
      ],
    });
  }

  const projectData = createProjectDataService();
  const result = await projectData.createMovieProject({
    projectName: options.input[0]!,
    title: options.title,
    aspectRatio: options.aspectRatio,
    logline: options.logline,
    summary: options.summary,
    homeDir: options.homeDir,
    storageRoot: options.storageRoot,
  });
  const currentProject = await projectData.openCurrentProject({
    projectName: result.projectName,
    homeDir: options.homeDir,
    storageRoot: options.storageRoot,
  });
  await appendProjectLibraryRefreshEvent({
    options,
    projectName: result.projectName,
    projectId: currentProject.projectId,
  });

  if (options.json) {
    options.io.stdout.log(JSON.stringify({ ...result, currentProject }, null, 2));
    return 0;
  }

  for (const warning of result.warnings) {
    options.io.stderr.error(formatDiagnosticIssue(warning));
  }

  options.io.stdout.log(`Renku project created: ${result.projectName}`);
  options.io.stdout.log(`Project: ${result.projectPath}`);
  options.io.stdout.log(`Database: ${result.databasePath}`);
  options.io.stdout.log(`Current authoring project: ${currentProject.projectName}`);
  options.io.stdout.log(
    'Created a clean movie project. Add screenplay content with `renku screenplay create --json --file <screenplay-json>`.'
  );

  return 0;
}

async function appendProjectLibraryRefreshEvent(input: {
  options: Pick<RunCreateCommandOptions, 'homeDir' | 'storageRoot' | 'io' | 'json'>;
  projectName: string;
  projectId?: string;
}): Promise<void> {
  try {
    const coordination = createStudioCoordinationService({
      homeDir: input.options.homeDir,
    });
    await coordination.appendStudioEvent({
      type: 'studio.projectRefreshRequested',
      projectRef: {
        name: input.projectName,
        id: input.projectId ?? input.projectName,
        storageRoot: await resolveRenkuStorageRoot({
          homeDir: input.options.homeDir,
          storageRoot: input.options.storageRoot,
        }),
      },
      surface: 'projectLibrary',
      source: { kind: 'cli', command: 'create' },
      operationId: createStudioOperationId(),
    });
  } catch (error) {
    const detail =
      error instanceof Error
        ? error.message
        : 'Studio coordination event could not be appended.';
    if (input.options.json) {
      input.options.io.stderr.error(
        JSON.stringify(
          {
            warnings: [
              {
                code: 'CLI027',
                message:
                  'Project was created, but Studio project library refresh coordination failed.',
                detail,
              },
            ],
          },
          null,
          2
        )
      );
      return;
    }
    input.options.io.stderr.error(
      `[CLI027] WARNING Project was created, but Studio project library refresh coordination failed: ${detail}`
    );
  }
}
