import { createDiagnosticError, StructuredError } from '@gorenku/studio-diagnostics';
import { createProjectDataService } from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../../cli.js';
import { appendStudioResourceChangedEvent } from '../studio-resource-event-command.js';
import { runScreenplayAnalysisCommand } from './analysis.js';
import { runScreenplayAuthoringCommand } from './authoring.js';
import { runScreenplayBeatsCommand } from './beats.js';
import { runScreenplayFdxImportCommand } from './fdx-import.js';
import { runScreenplayReadingCommand } from './reading.js';
import { runScreenplayRevisionCommand } from './revisions.js';
import { runScreenplaySceneNumberCommand } from './scene-numbers.js';

export interface ScreenplayCommandOptions {
  input: string[];
  flags: {
    file?: string;
    active?: boolean;
    analysis?: string;
    scene?: string;
    revision?: string;
    includeVisualReferences?: boolean;
    number?: string;
    dryRun?: boolean;
    project?: string;
  };
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}

export type ScreenplayCommandService = ReturnType<typeof createProjectDataService>;

export interface ScreenplayCommandContext extends ScreenplayCommandOptions {
  service: ScreenplayCommandService;
}

export async function runScreenplayCommand(options: ScreenplayCommandOptions): Promise<number> {
  const context: ScreenplayCommandContext = {
    ...options,
    service: createProjectDataService(),
  };
  const [subcommand] = options.input;

  if (subcommand === 'analyze') {
    return runScreenplayAnalysisCommand(context);
  }
  if (subcommand === 'beats') {
    return runScreenplayBeatsCommand(context);
  }
  if (subcommand === 'scene-number') {
    return runScreenplaySceneNumberCommand(context);
  }
  if (subcommand === 'revision') {
    return runScreenplayRevisionCommand(context);
  }
  if (subcommand === 'import-fdx') {
    return runScreenplayFdxImportCommand(context);
  }
  if (subcommand === 'create' || subcommand === 'apply') {
    return runScreenplayAuthoringCommand(context);
  }
  if (subcommand === 'status' || subcommand === 'show' || subcommand === 'structure' || subcommand === 'section' || subcommand === 'scene') {
    return runScreenplayReadingCommand(context);
  }

  throw unknownScreenplayCommand(subcommand);
}

export function writeScreenplayJson(io: RenkuCliIo, value: unknown): void {
  io.stdout.log(JSON.stringify(value, null, 2));
}

export function requiredScreenplayFlag(value: string | undefined, flag: string): string {
  if (value?.trim()) {
    return value.trim();
  }
  throw new StructuredError({
    code: 'CLI090',
    message: `${flag} is required.`,
    issues: [createDiagnosticError('CLI090', `${flag} is required.`, { path: [flag], context: 'renku CLI arguments' }, `Pass ${flag}.`)],
    suggestion: `Pass ${flag}.`,
  });
}

export async function resolveScreenplayProjectName(
  context: ScreenplayCommandContext,
): Promise<string> {
  const project = await context.service.resolveStudioProjectRef({
    homeDir: context.homeDir,
    projectName: context.flags.project,
  });
  return project.name;
}

export async function notifyScreenplayMutation(
  context: ScreenplayCommandContext,
  report: { project: { id?: string; projectName: string }; resourceKeys: string[] },
  command: string,
): Promise<void> {
  await appendStudioResourceChangedEvent({
    runtime: {
      homeDir: context.homeDir,
      json: context.json,
      io: context.io,
      projectDataService: context.service,
    },
    report,
    command,
  });
}

export function unknownScreenplayCommand(subcommand: string | undefined): StructuredError {
  return new StructuredError({
    code: 'CLI081',
    message: 'Unknown screenplay command.',
    issues: [createDiagnosticError(
      'CLI081',
      'Unknown screenplay command.',
      { path: ['screenplay', subcommand ?? ''] },
      'Use status, show, structure, section, scene, create, apply, import-fdx, revision, analyze, beats, or scene-number.',
    )],
    suggestion: 'Use a supported screenplay command.',
  });
}
