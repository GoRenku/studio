import {
  StructuredError,
  createDiagnosticError,
} from '@gorenku/studio-diagnostics';
import { createProjectDataService } from '@gorenku/studio-core/node';
import { formatDiagnosticIssue, type RenkuCliIo } from '../cli.js';

export interface RunCreateCommandOptions {
  input: string[];
  file?: string;
  cover?: string;
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}

export async function runCreateCommand(
  options: RunCreateCommandOptions
): Promise<number> {
  if (options.input.length > 0) {
    throw new StructuredError({
      code: 'CLI001',
      message:
        'Project names are read from project.name in the YAML. Usage: renku create --file <project.yaml>',
      issues: [
        createDiagnosticError(
          'CLI001',
          'Unexpected positional project name.',
          { path: ['create'], context: 'renku CLI arguments' },
          'Remove the positional name and set project.name in the YAML file.'
        ),
      ],
    });
  }

  if (!options.file) {
    throw new StructuredError({
      code: 'CLI002',
      message: 'Missing required --file option. Usage: renku create --file <project.yaml>',
      issues: [
        createDiagnosticError(
          'CLI002',
          'Missing required --file option.',
          { path: ['--file'], context: 'renku CLI arguments' },
          'Run renku create --file <project.yaml>.'
        ),
      ],
    });
  }

  const projectData = createProjectDataService();
  const result = await projectData.createFromSetup({
    setupPath: options.file,
    coverPath: options.cover,
    homeDir: options.homeDir,
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
  if (result.coverPath) {
    options.io.stdout.log(`Cover: ${result.coverPath}`);
  }
  options.io.stdout.log(
    `Created ${result.created.sequences} sequences, ${result.created.scenes} scenes, ${result.created.clips} clips.`
  );

  return 0;
}
