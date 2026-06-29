import { createProjectDataService } from '@gorenku/studio-core/server';
import { StructuredError } from '@gorenku/studio-diagnostics';
import type { RenkuCliIo } from '../cli.js';
import {
  dispatchCliCommand,
  readJsonFile,
  requiredFlag,
  writeJson,
  type CliCommandHandler,
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
  selectedShot?: string;
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
  return dispatchCliCommand({
    commandPath: input.commandPath,
    flags: input.flags,
    runtime: input.runtime,
    handlers: takeCommandHandlers,
    unknownCommand: unknownTakeCommand,
  });
}

export const takeCommandHandlers = [
  {
    path: ['list'],
    run: runTakeList,
  },
  {
    path: ['show'],
    run: runTakeShow,
  },
  {
    path: ['create'],
    run: runTakeCreate,
  },
  {
    path: ['authoring', 'context'],
    run: runTakeAuthoringContext,
  },
  {
    path: ['authoring', 'validate'],
    run: runTakeAuthoringValidate,
  },
  {
    path: ['authoring', 'apply'],
    run: runTakeAuthoringApply,
  },
] satisfies CliCommandHandler<TakeCommandFlags>[];

async function runTakeList(input: TakeCommandInput): Promise<unknown> {
  return input.runtime.projectDataService.listSceneShotVideoTakes({
    ...takeProjectInput(input.runtime),
    sceneId: requiredFlag(input.flags.scene, '--scene'),
  });
}

async function runTakeShow(input: TakeCommandInput): Promise<unknown> {
  return input.runtime.projectDataService.readSceneShotVideoTake({
    ...takeProjectInput(input.runtime),
    sceneId: input.flags.scene,
    takeId: requiredFlag(input.flags.take, '--take'),
  });
}

async function runTakeCreate(input: TakeCommandInput): Promise<unknown> {
  return input.runtime.projectDataService.createSceneShotVideoTake({
    ...takeProjectInput(input.runtime),
    sceneId: requiredFlag(input.flags.scene, '--scene'),
    shotListId: requiredFlag(input.flags.shotList, '--shot-list'),
    shotIds: parseShots(requiredFlag(input.flags.shots, '--shots')),
  });
}

async function runTakeAuthoringContext(input: TakeCommandInput): Promise<unknown> {
  return input.runtime.projectDataService.readSceneShotVideoTakeAuthoringContext({
    ...takeProjectInput(input.runtime),
    sceneId: input.flags.scene,
    takeId: requiredFlag(input.flags.take, '--take'),
    selectedShotId: input.flags.selectedShot,
  });
}

async function runTakeAuthoringValidate(input: TakeCommandInput): Promise<unknown> {
  return input.runtime.projectDataService.validateSceneShotVideoTakeAuthoringDocument({
    ...takeProjectInput(input.runtime),
    document: await readAuthoringDocument(input.flags),
  });
}

async function runTakeAuthoringApply(input: TakeCommandInput): Promise<unknown> {
  return input.runtime.projectDataService.applySceneShotVideoTakeAuthoringDocument({
    ...takeProjectInput(input.runtime),
    document: await readAuthoringDocument(input.flags),
  });
}

async function readAuthoringDocument(flags: TakeCommandFlags) {
  return (await readJsonFile(requiredFlag(flags.file, '--file'))) as never;
}

type TakeCommandInput = Parameters<CliCommandHandler<TakeCommandFlags>['run']>[0];

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
  const projectName = projectNameForResourceChangedResult(result);
  if (!projectName || resourceKeys.length === 0) {
    return null;
  }
  return {
    project: { name: projectName },
    resourceKeys,
  };
}

function projectNameForResourceChangedResult(
  result: Record<string, unknown>
): string | undefined {
  if (typeof result.projectName === 'string') {
    return result.projectName;
  }
  if (isObject(result.project) && typeof result.project.name === 'string') {
    return result.project.name;
  }
  return undefined;
}

function unknownTakeCommand(commandPath: readonly string[]): StructuredError {
  return new StructuredError({
    code: 'CLI107',
    message: `Unknown take command: ${commandPath.join(' ') || '(none)'}.`,
    suggestion:
      'Use take list, take show, take create, or take authoring context/validate/apply.',
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
