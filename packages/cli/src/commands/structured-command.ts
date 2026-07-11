import fs from 'node:fs/promises';
import type { ProjectDataService } from '@gorenku/studio-core/server';
import { StructuredError } from '@gorenku/studio-diagnostics';
import type { RenkuCliIo } from '../cli.js';

export interface CliCommandRuntime {
  projectName?: string;
  homeDir?: string;
  json: boolean;
  io: RenkuCliIo;
  projectDataService: ProjectDataService;
}

export interface CliCommandHandler<
  Flags,
  Runtime extends CliCommandRuntime = CliCommandRuntime,
> {
  path: readonly string[];
  run(input: {
    flags: Flags;
    runtime: Runtime;
  }): Promise<unknown>;
}

export async function dispatchCliCommand<
  Flags,
  Runtime extends CliCommandRuntime = CliCommandRuntime,
>(input: {
  commandPath: readonly string[];
  flags: Flags;
  runtime: Runtime;
  handlers: readonly CliCommandHandler<Flags, Runtime>[];
  unknownCommand: (commandPath: readonly string[]) => StructuredError;
}): Promise<unknown> {
  const handler = input.handlers.find((candidate) =>
    matchesCommandPath(candidate.path, input.commandPath)
  );
  if (!handler) {
    throw input.unknownCommand(input.commandPath);
  }
  return handler.run({ flags: input.flags, runtime: input.runtime });
}

export function requiredFlag(value: string | undefined, flag: string): string {
  if (!value) {
    throw new StructuredError({
      code: 'CLI001',
      message: `Missing required flag: ${flag}.`,
    });
  }
  return value;
}

export async function readJsonFile(filePath: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(filePath, 'utf8')) as unknown;
}

export function writeJson(io: RenkuCliIo, value: unknown): void {
  io.stdout.log(JSON.stringify(value, null, 2));
}

function matchesCommandPath(
  expected: readonly string[],
  actual: readonly string[]
): boolean {
  return (
    expected.length === actual.length &&
    expected.every((segment, index) => actual[index] === segment)
  );
}
