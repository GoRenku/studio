import {
  StructuredError,
  createDiagnosticError,
} from '@gorenku/studio-diagnostics';
import { createProjectDataService } from '@gorenku/studio-core/server';
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
      message:
        'Project creation no longer imports setup YAML. Create the project with `renku create <project-name> --title <title>`, then add screenplay content with `renku screenplay create --file <screenplay-json>`.',
      issues: [
        createDiagnosticError(
          'CLI001',
          '`renku create --file` is no longer supported.',
          { path: ['--file'], context: 'renku CLI arguments' },
          'Use `renku create <project-name> --title <title>` and then `renku screenplay create --file <screenplay-json>`.'
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

  if (options.json) {
    options.io.stdout.log(JSON.stringify(result, null, 2));
    return 0;
  }

  for (const warning of result.warnings) {
    options.io.stderr.error(formatDiagnosticIssue(warning));
  }

  options.io.stdout.log(`Renku project created: ${result.projectName}`);
  options.io.stdout.log(`Project: ${result.projectPath}`);
  options.io.stdout.log(`Database: ${result.databasePath}`);
  options.io.stdout.log(
    'Created a clean movie project. Add screenplay content with `renku screenplay create --file <screenplay-json>`.'
  );

  return 0;
}
