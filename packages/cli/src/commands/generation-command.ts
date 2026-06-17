import { createProjectDataService } from '@gorenku/studio-core/server';
import { StructuredError } from '@gorenku/studio-diagnostics';
import type { RenkuCliIo } from '../cli.js';
import {
  generationCommandHandlers,
  type GenerationCommandFlags,
} from './generation-command-handlers.js';
import {
  dispatchCliCommand,
  writeJson,
  type CliCommandRuntime,
} from './structured-command.js';
import {
  appendStudioResourceChangedEvent,
  type StudioResourceChangedReport,
} from './studio-resource-event-command.js';

export async function runGenerationCommand(options: {
  input: string[];
  flags: GenerationCommandFlags;
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}): Promise<number> {
  const runtime: CliCommandRuntime = {
    projectName: options.flags.project,
    homeDir: options.homeDir,
    json: options.json,
    io: options.io,
    projectDataService: createProjectDataService(),
  };
  const result = await dispatchCliCommand({
    commandPath: options.input,
    flags: options.flags,
    runtime,
    handlers: generationCommandHandlers,
    unknownCommand: unknownGenerationCommand,
  });
  const resourceChangedReport = generationResourceChangedReport(
    options.input,
    result,
  );
  if (resourceChangedReport) {
    await appendStudioResourceChangedEvent({
      runtime,
      report: resourceChangedReport,
      command: `generation ${options.input.join(' ')}`,
    });
  }
  writeJson(options.io, result);
  return 0;
}

export function generationResourceChangedReport(
  commandPath: readonly string[],
  result: unknown,
): StudioResourceChangedReport | null {
  const mutationPath = commandPath.join(' ');
  if (
    mutationPath !== 'production update' &&
    mutationPath !== 'take create' &&
    mutationPath !== 'take update-shots' &&
    mutationPath !== 'input select' &&
    mutationPath !== 'input clear' &&
    mutationPath !== 'dialogue-audio generate' &&
    mutationPath !== 'dialogue-audio pick'
  ) {
    return null;
  }
  return resourceChangedReportFromResult(result);
}

function resourceChangedReportFromResult(
  result: unknown,
): StudioResourceChangedReport | null {
  const directReport = directResourceChangedReport(result);
  if (directReport) {
    return directReport;
  }

  if (!isObject(result) || !Array.isArray(result.generated)) {
    return null;
  }

  const generatedReports = result.generated
    .map((report) => directResourceChangedReport(report))
    .filter((report): report is StudioResourceChangedReport => Boolean(report));
  const project = generatedReports[0]?.project;
  if (!project) {
    return null;
  }
  return {
    project,
    resourceKeys: [
      ...new Set(generatedReports.flatMap((report) => report.resourceKeys)),
    ],
  };
}

function directResourceChangedReport(
  result: unknown,
): StudioResourceChangedReport | null {
  if (!isObject(result) || !Array.isArray(result.resourceKeys)) {
    return null;
  }

  if ('project' in result && isProjectRef(result.project)) {
    return { project: result.project, resourceKeys: result.resourceKeys };
  }

  return contextResourceChangedReport(result);
}

function contextResourceChangedReport(
  result: Record<string, unknown>,
): StudioResourceChangedReport | null {
  if (
    'context' in result &&
    isObject(result.context) &&
    'project' in result.context &&
    isProjectRef(result.context.project) &&
    isStringArray(result.resourceKeys)
  ) {
    return {
      project: result.context.project,
      resourceKeys: result.resourceKeys,
    };
  }

  return null;
}

function isProjectRef(
  value: unknown,
): value is StudioResourceChangedReport['project'] {
  return isObject(value) && typeof value.name === 'string';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function unknownGenerationCommand(
  commandPath: readonly string[],
): StructuredError {
  return new StructuredError({
    code: 'CLI019',
    message: `Unknown generation command: ${commandPath.join(' ') || '(none)'}.`,
    suggestion:
      'Use generation context, generation model list, generation spec validate/create/update/show/list, generation estimate, or generation run.',
  });
}
