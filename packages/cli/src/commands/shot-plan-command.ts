import { createProjectDataService } from '@gorenku/studio-core/server';
import { StructuredError } from '@gorenku/studio-diagnostics';
import type { RenkuCliIo } from '../cli.js';
import {
  shotPlanCommandHandlers,
  type ShotPlanCommandFlags,
} from './shot-plan-command-handlers.js';
import { appendStudioResourceChangedEvent } from './studio-resource-event-command.js';
import { dispatchCliCommand, writeJson } from './structured-command.js';

export async function runShotPlanCommand(options: {
  input: string[];
  flags: ShotPlanCommandFlags;
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}): Promise<number> {
  const runtime = {
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
    handlers: shotPlanCommandHandlers,
    unknownCommand: (path) =>
      new StructuredError({
        code: 'CLI151',
        message: `Unknown shot-plan command: ${path.join(' ') || '(none)'}.`,
        suggestion: 'Run renku --help to see Shot Plan commands.',
      }),
  });
  if (isMutationPath(options.input) && hasResourceReport(result)) {
    await appendStudioResourceChangedEvent({
      runtime,
      report: result,
      command: `shot-plan ${options.input.join(' ')}`,
    });
  }
  if (options.json) {
    writeJson(options.io, result);
  } else {
    writeHumanResult(options.io, result);
  }
  return 0;
}

function isMutationPath(path: readonly string[]): boolean {
  return !['list', 'show', 'validate'].includes(path.join(' '));
}

function hasResourceReport(
  value: unknown
): value is {
  project: { name: string };
  resourceKeys: string[];
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    'project' in value &&
    typeof value.project === 'object' &&
    value.project !== null &&
    'name' in value.project &&
    typeof value.project.name === 'string' &&
    'resourceKeys' in value &&
    Array.isArray(value.resourceKeys)
  );
}

function writeHumanResult(io: RenkuCliIo, result: unknown): void {
  if (
    typeof result === 'object' &&
    result !== null &&
    'shotPlan' in result &&
    typeof result.shotPlan === 'object' &&
    result.shotPlan !== null &&
    'title' in result.shotPlan
  ) {
    io.stdout.log(String(result.shotPlan.title));
    return;
  }
  if (
    typeof result === 'object' &&
    result !== null &&
    'shotPlans' in result &&
    Array.isArray(result.shotPlans)
  ) {
    if (result.shotPlans.length === 0) {
      io.stdout.log('No Shot Plans found.');
      return;
    }
    for (const entry of result.shotPlans) {
      const shotPlan =
        typeof entry === 'object' && entry !== null && 'shotPlan' in entry
          ? entry.shotPlan
          : entry;
      if (
        typeof shotPlan === 'object' &&
        shotPlan !== null &&
        'id' in shotPlan &&
        'title' in shotPlan
      ) {
        io.stdout.log(`${String(shotPlan.id)} ${String(shotPlan.title)}`);
      }
    }
    return;
  }
  io.stdout.log('Shot Plan command completed.');
}
