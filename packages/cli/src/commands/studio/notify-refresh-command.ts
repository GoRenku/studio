import { createProjectDataService } from '@gorenku/studio-core/server';
import {
  StructuredError,
  createDiagnosticError,
} from '@gorenku/studio-diagnostics';
import { appendStudioResourceChangedEvent } from '../studio-resource-event-command.js';
import type { StudioCommandOptions } from './contracts.js';

export async function runStudioNotifyRefreshCommand(
  options: StudioCommandOptions
): Promise<number> {
  if (options.input.length !== 1) {
    options.io.stderr.error(
      'Usage: renku studio notify-refresh --project <project-name> --resource <resource-key> --json'
    );
    return 1;
  }
  const project = requiredStudioFlag(options.project, '--project');
  const resourceKeys = (options.resource ?? [])
    .map((resource) => resource.trim())
    .filter(Boolean);
  if (resourceKeys.length === 0) {
    throw missingStudioFlag('--resource');
  }
  const projectDataService = createProjectDataService();
  const eventProject = await readStudioNotifyRefreshProject(
    projectDataService,
    project,
    options.homeDir
  );
  await appendStudioResourceChangedEvent({
    runtime: {
      projectName: project,
      homeDir: options.homeDir,
      json: options.json,
      io: options.io,
      projectDataService,
    },
    report: { project: eventProject, resourceKeys },
    command: 'studio notify-refresh',
  });
  const report = { valid: true, project: eventProject, resourceKeys };
  if (options.json) {
    options.io.stdout.log(JSON.stringify(report, null, 2));
  } else {
    options.io.stdout.log(
      `Requested Studio refresh for ${resourceKeys.length} resource(s).`
    );
  }
  return 0;
}

async function readStudioNotifyRefreshProject(
  projectDataService: ReturnType<typeof createProjectDataService>,
  projectName: string,
  homeDir?: string
): Promise<{ projectName: string; id: string }> {
  const project = await projectDataService.readProjectShell({ projectName, homeDir });
  return { projectName: project.project.projectName, id: project.project.id };
}

function requiredStudioFlag(value: string | undefined, name: string): string {
  if (!value?.trim()) {
    throw missingStudioFlag(name);
  }
  return value.trim();
}

function missingStudioFlag(flag: string): StructuredError {
  return new StructuredError({
    code: 'CLI143',
    message: `Missing required flag: ${flag}.`,
    issues: [
      createDiagnosticError(
        'CLI143',
        `Missing required flag: ${flag}.`,
        { path: ['studio', 'notify-refresh', flag], context: 'renku CLI arguments' },
        'Run renku studio notify-refresh --project <project-name> --resource <resource-key> --json.'
      ),
    ],
  });
}
