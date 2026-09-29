import { createProjectDataService } from '@gorenku/studio-core/server';
import { StructuredError } from '@gorenku/studio-diagnostics';
import { renderMediaImport } from './media-import/output.js';
import type { RenkuCliIo } from '../cli.js';
import {
  mediaImportCommandHandler,
  type MediaCommandFlags,
} from './media-import/command.js';
import {
  dispatchCliCommand,
  writeJson,
  type CliCommandRuntime,
} from './structured-command.js';

export async function runMediaCommand(options: {
  input: string[];
  flags: MediaCommandFlags;
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
    handlers: [mediaImportCommandHandler],
    unknownCommand: unknownMediaCommand,
  });
  if (options.json) {
    writeJson(options.io, result);
  } else {
    options.io.stdout.log(renderMediaImport(result as Parameters<typeof renderMediaImport>[0]));
  }
  return 0;
}

function unknownMediaCommand(commandPath: readonly string[]): StructuredError {
  return new StructuredError({
    code: 'CLI023',
    message: `Unknown media command: ${commandPath.join(' ') || '(none)'}.`,
    suggestion: 'Use media import.',
  });
}
