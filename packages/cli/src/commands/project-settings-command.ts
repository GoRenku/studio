import { StructuredError, createDiagnosticError } from '@gorenku/studio-diagnostics';
import { createProjectDataService } from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../cli.js';
import { readJsonInput } from './command-io.js';
import { appendStudioResourceChangedEvent } from './studio-resource-event-command.js';

export interface RunProjectSettingsCommandOptions {
  input: string[];
  flags: {
    project?: string;
    file?: string;
  };
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}

export async function runProjectSettingsCommand(
  options: RunProjectSettingsCommandOptions
): Promise<number> {
  const [subcommand] = options.input;
  if (subcommand === 'show') {
    return await showProjectSettings(options);
  }
  if (subcommand === 'set') {
    return await setProjectSettings(options);
  }
  throw new StructuredError({
    code: 'CLI020',
    message: 'Unknown settings command. Usage: renku settings show|set ...',
    issues: [
      createDiagnosticError(
        'CLI020',
        'Unknown settings command.',
        { path: ['settings'], context: 'renku CLI arguments' },
        'Run renku settings show or renku settings set --file <project-settings.json>.'
      ),
    ],
  });
}

async function showProjectSettings(
  options: RunProjectSettingsCommandOptions
): Promise<number> {
  const service = createProjectDataService();
  const projectName = await resolveProjectName(service, options);
  const resource = await service.readProjectSettings({
    projectName,
    homeDir: options.homeDir,
  });
  if (options.json) {
    options.io.stdout.log(JSON.stringify(resource.settings, null, 2));
  } else {
    options.io.stdout.log(`Project Settings: ${resource.project.name}`);
    options.io.stdout.log(JSON.stringify(resource.settings, null, 2));
  }
  return 0;
}

async function setProjectSettings(
  options: RunProjectSettingsCommandOptions
): Promise<number> {
  const file = requiredFile(options.flags.file);
  const settings = await readJsonInput(file);
  const service = createProjectDataService();
  const projectName = await resolveProjectName(service, options);
  const report = await service.replaceProjectSettings({
    projectName,
    homeDir: options.homeDir,
    settings,
  });
  await appendStudioResourceChangedEvent({
    runtime: {
      projectName,
      homeDir: options.homeDir,
      json: options.json,
      io: options.io,
      projectDataService: service,
    },
    report: {
      project: {
        projectName: report.resource.project.name,
        id: report.resource.project.id,
      },
      resourceKeys: report.resourceKeys,
    },
    command: 'renku settings set',
  });
  if (options.json) {
    options.io.stdout.log(JSON.stringify(report, null, 2));
  } else {
    options.io.stdout.log(`Project Settings updated: ${report.resource.project.name}`);
  }
  return 0;
}

async function resolveProjectName(
  service: ReturnType<typeof createProjectDataService>,
  options: RunProjectSettingsCommandOptions
): Promise<string> {
  const project = await service.resolveStudioProjectRef({
    projectName: options.flags.project,
    homeDir: options.homeDir,
  });
  return project.name;
}

function requiredFile(file: string | undefined): string {
  if (file) {
    return file;
  }
  throw new StructuredError({
    code: 'CLI001',
    message: 'Missing required flag: --file.',
  });
}
