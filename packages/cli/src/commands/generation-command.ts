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
import { appendStudioResourceChangedEvent } from './studio-resource-event-command.js';

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
  if (shouldAppendGenerationResourceChangedEvent(options.input, result)) {
    await appendStudioResourceChangedEvent({
      runtime,
      report: result,
      command: `generation ${options.input.join(' ')}`,
    });
  }
  writeJson(options.io, result);
  return 0;
}

function shouldAppendGenerationResourceChangedEvent(
  commandPath: readonly string[],
  result: unknown
): result is {
  project: { name: string; id?: string };
  resourceKeys: string[];
} {
  const mutationPath = commandPath.join(' ');
  if (
    mutationPath !== 'production update' &&
    mutationPath !== 'input select' &&
    mutationPath !== 'input clear' &&
    mutationPath !== 'dialogue-audio generate' &&
    mutationPath !== 'dialogue-audio pick'
  ) {
    return false;
  }
  return (
    typeof result === 'object' &&
    result !== null &&
    'project' in result &&
    'resourceKeys' in result &&
    Array.isArray((result as { resourceKeys?: unknown }).resourceKeys)
  );
}

function unknownGenerationCommand(commandPath: readonly string[]): StructuredError {
  return new StructuredError({
    code: 'CLI019',
    message: `Unknown generation command: ${commandPath.join(' ') || '(none)'}.`,
    suggestion:
      'Use generation context, generation model list, generation spec validate/create/update/show/list, generation estimate, or generation run.',
  });
}
