import { createProjectDataService } from '@gorenku/studio-core/server';
import { StructuredError } from '@gorenku/studio-diagnostics';
import type {
  MediaEngine,
  ProviderContext,
  ProviderExecutionContext,
} from '@gorenku/studio-engines';
import type { RenkuCliIo } from '../../cli.js';
import {
  dispatchCliCommand,
  writeJson,
  type CliCommandHandler,
  type CliCommandRuntime,
} from '../structured-command.js';
import { executeGenerationRequest } from './execute.js';
import { recoverGenerationRequest } from './recover.js';
import { showGenerationPreview } from './preview.js';
import { validateGenerationRequest } from './validate.js';
import { showGenerationContext } from './context.js';
import { showGenerationSchema } from './schema.js';
import {
  inspectGenerationConfigurationVisualization,
  invalidateGenerationConfigurationVisualization,
  refreshGenerationConfigurationVisualization,
  storeGenerationConfigurationVisualization,
} from './configuration-visualization.js';

export interface GenerationCommandFlags {
  project?: string;
  file?: string | string[];
  output?: string;
  requestId?: string;
  purpose?: string;
  target?: string;
  revision?: string;
  beat?: string | string[];
  provider?: string;
  model?: string;
  schema?: string;
  template?: string;
}

export type GenerationCommandRuntime = CliCommandRuntime & {
  mediaEngine?: MediaEngine;
  createProviderContext?: (input: {
    provider: string;
    homeDir?: string;
    signal: AbortSignal;
  }) => Promise<ProviderContext>;
  createProviderExecutionContext?: (input: {
    provider: string;
    homeDir?: string;
    signal: AbortSignal;
    outputDirectory: string;
  }) => Promise<ProviderExecutionContext>;
};
export type GenerationCommandInput = Parameters<
  CliCommandHandler<GenerationCommandFlags, GenerationCommandRuntime>['run']
>[0];

const handlers = [
  { path: ['context'], run: showGenerationContext },
  { path: ['schema', 'show'], run: showGenerationSchema },
  { path: ['configuration-visualization', 'inspect'], run: inspectGenerationConfigurationVisualization },
  { path: ['configuration-visualization', 'store'], run: storeGenerationConfigurationVisualization },
  { path: ['configuration-visualization', 'refresh'], run: refreshGenerationConfigurationVisualization },
  { path: ['configuration-visualization', 'invalidate'], run: invalidateGenerationConfigurationVisualization },
  { path: ['validate'], run: validateGenerationRequest },
  { path: ['preview', 'show'], run: showGenerationPreview },
  { path: ['execute'], run: executeGenerationRequest },
  { path: ['recover'], run: recoverGenerationRequest },
] satisfies CliCommandHandler<GenerationCommandFlags, GenerationCommandRuntime>[];

export async function runGenerationCommand(options: {
  input: string[];
  flags: GenerationCommandFlags;
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}): Promise<number> {
  const runtime: GenerationCommandRuntime = {
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
    handlers,
    unknownCommand: (commandPath) => new StructuredError({
      code: 'CLI019',
      message: `Unknown generation command: ${commandPath.join(' ') || '(none)'}.`,
      suggestion: 'Use generation context, schema show, configuration-visualization, validate, preview show, execute, or recover.',
    }),
  });
  writeJson(options.io, result);
  return 0;
}
