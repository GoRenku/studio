import { createProjectDataService } from '@gorenku/studio-core/server';
import { StructuredError } from '@gorenku/studio-diagnostics';
import type { RenkuCliIo } from '../cli.js';
import {
  readJsonFile,
  requiredFlag,
  writeJson,
  type CliCommandRuntime,
} from './structured-command.js';
import { parseShots } from './studio-target-parsing.js';
import {
  appendStudioResourceChangedEvent,
  type StudioResourceChangedReport,
} from './studio-resource-event-command.js';

export interface TakeCommandFlags {
  project?: string;
  scene?: string;
  shotList?: string;
  shots?: string;
  take?: string;
  file?: string;
}

export async function runTakeCommand(options: {
  input: string[];
  flags: TakeCommandFlags;
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
  const result = await runTakeCommandPath({
    commandPath: options.input,
    flags: options.flags,
    runtime,
  });
  const resourceChangedReport = takeResourceChangedReport(result);
  if (resourceChangedReport) {
    await appendStudioResourceChangedEvent({
      runtime,
      report: resourceChangedReport,
      command: `take ${options.input.join(' ')}`,
    });
  }
  writeJson(options.io, result);
  return 0;
}

async function runTakeCommandPath(input: {
  commandPath: string[];
  flags: TakeCommandFlags;
  runtime: CliCommandRuntime;
}): Promise<unknown> {
  const [command, extra] = input.commandPath;
  if (extra) {
    throw unknownTakeCommand(input.commandPath);
  }
  switch (command) {
    case 'list':
      return input.runtime.projectDataService.listSceneShotVideoTakes({
        ...takeProjectInput(input.runtime),
        sceneId: requiredFlag(input.flags.scene, '--scene'),
      });
    case 'show':
      return input.runtime.projectDataService.readSceneShotVideoTake({
        ...takeProjectInput(input.runtime),
        takeId: requiredFlag(input.flags.take, '--take'),
      });
    case 'create':
      return input.runtime.projectDataService.createSceneShotVideoTake({
        ...takeProjectInput(input.runtime),
        sceneId: requiredFlag(input.flags.scene, '--scene'),
        shotListId: requiredFlag(input.flags.shotList, '--shot-list'),
        shotIds: parseShots(requiredFlag(input.flags.shots, '--shots')),
      });
    case 'update':
      return input.runtime.projectDataService.updateSceneShotVideoTakeState({
        ...takeProjectInput(input.runtime),
        takeId: requiredFlag(input.flags.take, '--take'),
        statePatch: (await readJsonFile(requiredFlag(input.flags.file, '--file'))) as never,
      });
    default:
      throw unknownTakeCommand(input.commandPath);
  }
}

function takeProjectInput(runtime: CliCommandRuntime): {
  projectName?: string;
  homeDir?: string;
} {
  return {
    projectName: runtime.projectName,
    homeDir: runtime.homeDir,
  };
}

function takeResourceChangedReport(
  result: unknown
): StudioResourceChangedReport | null {
  if (!isObject(result)) {
    return null;
  }
  const resourceKeys = Array.isArray(result.resourceKeys)
    ? result.resourceKeys.filter((key): key is string => typeof key === 'string')
    : [];
  const projectName =
    typeof result.projectName === 'string'
      ? result.projectName
      : isObject(result.project) && typeof result.project.name === 'string'
        ? result.project.name
        : undefined;
  if (!projectName || resourceKeys.length === 0) {
    return null;
  }
  return {
    project: { name: projectName },
    resourceKeys,
  };
}

function unknownTakeCommand(commandPath: readonly string[]): StructuredError {
  return new StructuredError({
    code: 'CLI107',
    message: `Unknown take command: ${commandPath.join(' ') || '(none)'}.`,
    suggestion:
      'Use take list, take show, take create, or take update.',
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
