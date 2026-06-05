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
  writeJson(options.io, result);
  return 0;
}

function unknownGenerationCommand(commandPath: readonly string[]): StructuredError {
  return new StructuredError({
    code: 'CLI019',
    message: `Unknown generation command: ${commandPath.join(' ') || '(none)'}.`,
    suggestion:
      'Use generation context, generation model list, generation spec validate/create/update/show/list, generation estimate, or generation run.',
  });
}
