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
import { prepareGenerationRequest } from './prepare.js';
import { showGenerationContext } from './context.js';
import { renderMediaGenerationContext } from './context-output/index.js';
import { renderGenerationExecution } from './execution-output.js';
import type { GenerationExecutionReport } from './execution-result.js';
import { showGenerationSchema } from './schema.js';
import { listGenerationModels, showGenerationModel } from './models/queries.js';
import { importGenerationModel, removeGenerationModel } from './models/mutations.js';
import { syncGenerationDefaultModels } from './default-models-sync.js';
import { estimateGenerationRequest } from './estimate.js';
import { recordGenerationPrice, showGenerationPrice } from './price.js';

export interface GenerationCommandFlags {
  project?: string;
  file?: string | string[];
  output?: string;
  requestId?: string;
  expectedRequestSha256?: string;
  purpose?: string;
  target?: string;
  revision?: string;
  beat?: string | string[];
  provider?: string;
  model?: string;
  routeIndex?: string[];
  query?: string;
  ifRevision?: string;
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
  { path: ['models', 'list'], run: listGenerationModels },
  { path: ['models', 'show'], run: showGenerationModel },
  { path: ['models', 'import'], run: importGenerationModel },
  { path: ['models', 'remove'], run: removeGenerationModel },
  { path: ['default-models', 'sync'], run: syncGenerationDefaultModels },
  { path: ['price', 'show'], run: showGenerationPrice },
  { path: ['price', 'record'], run: recordGenerationPrice },
  { path: ['estimate'], run: estimateGenerationRequest },
  { path: ['context'], run: showGenerationContext },
  { path: ['schema', 'show'], run: showGenerationSchema },
  { path: ['validate'], run: validateGenerationRequest },
  { path: ['prepare'], run: prepareGenerationRequest },
  { path: ['preview', 'show'], run: showGenerationPreview },
  { path: ['execute'], run: executeGenerationRequest },
  { path: ['recover'], run: recoverGenerationRequest },
] satisfies CliCommandHandler<GenerationCommandFlags, GenerationCommandRuntime>[];

const textRenderers: Record<string, (report: unknown) => string> = {
  context: (report) => renderMediaGenerationContext(report as Awaited<ReturnType<typeof showGenerationContext>>),
  execute: (report) => renderGenerationExecution(report as GenerationExecutionReport),
  recover: (report) => renderGenerationExecution(report as GenerationExecutionReport),
};

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
      suggestion: 'Use generation context, models, default-models sync, price show|record, estimate, schema show, prepare, validate, preview show, execute, or recover.',
    }),
  });
  const render = textRenderers[options.input.join(' ')];
  if (!options.json && render) {
    options.io.stdout.log(render(result));
  } else {
    writeJson(options.io, result);
  }
  return 0;
}
