import {
  createProjectDataService,
  createStudioCoordinationService,
  createStudioOperationId,
  resolveRenkuStorageRoot,
  type StudioProjectRef,
} from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../cli.js';

export async function runProjectSelectionCommand(options: {
  input: string[];
  storageRoot?: string;
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}): Promise<number> {
  const [subcommand, projectName] = options.input;
  if (subcommand === 'current') {
    const current = await createStudioCoordinationService({
      homeDir: options.homeDir,
    }).readStudioCurrent();
    if (options.json) {
      options.io.stdout.log(JSON.stringify({ project: current.project }, null, 2));
    } else {
      options.io.stdout.log(
        current.project
          ? `Current project: ${current.project.name}`
          : 'No current project is selected.'
      );
    }
    return 0;
  }

  if (subcommand === 'migrate' && projectName) {
    const report = await createProjectDataService().migrateProjectDatabase({
      projectName,
      homeDir: options.homeDir,
      storageRoot: options.storageRoot,
    });

    if (options.json) {
      options.io.stdout.log(JSON.stringify(report, null, 2));
    } else {
      options.io.stdout.log(`Renku project database migrated: ${report.projectName}`);
      options.io.stdout.log(`Project: ${report.projectPath}`);
      options.io.stdout.log(`Database: ${report.databasePath}`);
    }
    return 0;
  }

  if (subcommand === 'select' && projectName) {
    const project = await createProjectDataService().readProject({
      projectName,
      homeDir: options.homeDir,
    });
    const projectRef: StudioProjectRef = {
      name: project.identity.name,
      id: project.identity.id,
      storageRoot: await resolveRenkuStorageRoot({ homeDir: options.homeDir }),
    };
    await createStudioCoordinationService({ homeDir: options.homeDir }).appendStudioEvent({
      type: 'studio.focusRequested',
      projectRef,
      focus: {
        screen: 'movieStudio',
        selection: { type: 'storyboard' },
      },
      refresh: { project: true, library: true },
      source: { kind: 'cli', command: 'renku project select' },
      operationId: createStudioOperationId(),
    });

    if (options.json) {
      options.io.stdout.log(JSON.stringify({ project: projectRef }, null, 2));
    } else {
      options.io.stdout.log(`Studio project selection requested: ${projectRef.name}`);
    }
    return 0;
  }

  options.io.stderr.error(
    'Usage: renku project current|select <project-name>|migrate <project-name>'
  );
  return 1;
}
