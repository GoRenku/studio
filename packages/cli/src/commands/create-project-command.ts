import { createProjectDataService } from '@gorenku/studio-core/node';
import type { RenkuCliIo } from '../cli.js';

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
    options.io.stderr.error(
      'Project names are read from project.name in the YAML. Usage: renku create --file <project.yaml>'
    );
    return 1;
  }

  if (!options.file) {
    options.io.stderr.error(
      'Missing required --file option. Usage: renku create --file <project.yaml>'
    );
    return 1;
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
