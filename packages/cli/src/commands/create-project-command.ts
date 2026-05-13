import {
  StructuredError,
  createDiagnosticError,
} from '@gorenku/studio-diagnostics';
import { createProjectDataService } from '@gorenku/studio-core/server';
import { formatDiagnosticIssue, type RenkuCliIo } from '../cli.js';

export interface RunCreateCommandOptions {
  input: string[];
  file?: string;
  fromNarrative?: string;
  cover?: string;
  storageRoot?: string;
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
        'Project names are read from project.name in the YAML. Usage: renku create --file <project.yaml> or renku create --from-narrative <narrative.yaml>',
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

  if (options.file && options.fromNarrative) {
    throw new StructuredError({
      code: 'CLI003',
      message:
        'Use either --file or --from-narrative, not both.',
      issues: [
        createDiagnosticError(
          'CLI003',
          'Conflicting create inputs.',
          { path: ['create'], context: 'renku CLI arguments' },
          'Use --from-narrative for narrative starter YAML or --file for project setup YAML.'
        ),
      ],
    });
  }

  if (!options.file && !options.fromNarrative) {
    throw new StructuredError({
      code: 'CLI002',
      message:
        'Missing required create input. Usage: renku create --file <project.yaml> or renku create --from-narrative <narrative.yaml>',
      issues: [
        createDiagnosticError(
          'CLI002',
          'Missing required create input.',
          { path: ['create'], context: 'renku CLI arguments' },
          'Run renku create --from-narrative <narrative.yaml> or renku create --file <project.yaml>.'
        ),
      ],
    });
  }

  const projectData = createProjectDataService();
  const result = options.fromNarrative
    ? await projectData.createFromNarrativeStarter({
        starterPath: options.fromNarrative,
        homeDir: options.homeDir,
        storageRoot: options.storageRoot,
      })
    : await projectData.createFromSetup({
        setupPath: options.file!,
        coverPath: options.cover,
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
  if (result.coverPath) {
    options.io.stdout.log(`Cover: ${result.coverPath}`);
  }
  options.io.stdout.log(
    `Created ${result.created.sequences} sequences, ${result.created.scenes} scenes, ${result.created.clips} clips.`
  );

  return 0;
}
