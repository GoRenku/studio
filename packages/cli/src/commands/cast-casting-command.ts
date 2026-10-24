import { createDiagnosticError, StructuredError } from '@gorenku/studio-diagnostics';
import { CASTING_CANDIDATE_STATUSES, type CastingCandidateStatus } from '@gorenku/studio-core/client';
import { createProjectDataService } from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../cli.js';
import { readRequiredJsonInput, requiredFlag, writeJson } from './command-io.js';
import {
  appendStudioResourceChangedEvent,
  type StudioResourceChangedReport,
} from './studio-resource-event-command.js';

export interface CastCastingCommandFlags {
  file?: string;
  project?: string;
  cast?: string;
  look?: string;
  assetFile?: string;
  status?: string;
}

interface CastCastingCommandContext {
  flags: CastCastingCommandFlags;
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
  service: ReturnType<typeof createProjectDataService>;
}

type CastCastingCommandHandler = (context: CastCastingCommandContext) => Promise<void>;

/**
 * `renku cast looks|wardrobe|casting ...`: thin wrappers over the core casting
 * commands, keyed by their command path.
 */
const CAST_CASTING_COMMANDS: Record<string, CastCastingCommandHandler> = {
  'looks show': async (context) => writeJson(context.io, await context.service.showCastLooks({
    homeDir: context.homeDir,
    castMemberId: requiredFlag(context.flags.cast, '--cast'),
  })),
  'looks validate': async (context) => writeJson(context.io, await context.service.validateCastLooksPlan(await documentInput(context, 'cast looks validate'))),
  'looks write': async (context) => writeAndNotify(context, 'cast looks write', await context.service.writeCastLooksPlan(await documentInput(context, 'cast looks write'))),
  'wardrobe show': async (context) => writeJson(context.io, await context.service.showCastWardrobe({
    homeDir: context.homeDir,
    castMemberId: requiredFlag(context.flags.cast, '--cast'),
  })),
  'wardrobe validate': async (context) => writeJson(context.io, await context.service.validateCastWardrobePlan(await documentInput(context, 'cast wardrobe validate'))),
  'wardrobe write': async (context) => writeAndNotify(context, 'cast wardrobe write', await context.service.writeCastWardrobePlan(await documentInput(context, 'cast wardrobe write'))),
  'casting round create': async (context) => writeAndNotify(context, 'cast casting round create', await context.service.createCastingRound(await documentInput(context, 'cast casting round create'))),
  'casting show': async (context) => writeJson(context.io, await context.service.showCastingLook({
    homeDir: context.homeDir,
    lookId: requiredFlag(context.flags.look, '--look'),
  })),
  'casting candidate status': async (context) => writeAndNotify(context, 'cast casting candidate status', await context.service.setCastingCandidateStatus({
    homeDir: context.homeDir,
    assetFileId: requiredFlag(context.flags.assetFile, '--asset-file'),
    status: candidateStatus(context.flags.status),
  })),
};

export async function runCastCastingCommand(options: {
  input: string[];
  flags: CastCastingCommandFlags;
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}): Promise<number> {
  const handler = CAST_CASTING_COMMANDS[options.input.slice(0, 3).join(' ')]
    ?? CAST_CASTING_COMMANDS[options.input.slice(0, 2).join(' ')];
  if (!handler) {
    throw unknownCommand(options.input);
  }
  await handler({ ...options, service: createProjectDataService() });
  return 0;
}

async function documentInput(context: CastCastingCommandContext, command: string) {
  const filePath = requiredFlag(context.flags.file, '--file');
  return {
    homeDir: context.homeDir,
    document: await readRequiredJsonInput(filePath, command),
    ...(filePath !== '-' ? { filePath } : {}),
  };
}

async function writeAndNotify(context: CastCastingCommandContext, command: string, report: StudioResourceChangedReport): Promise<void> {
  await appendStudioResourceChangedEvent({
    runtime: {
      projectName: context.flags.project,
      homeDir: context.homeDir,
      json: context.json,
      io: context.io,
      projectDataService: context.service,
    },
    report,
    command,
  });
  writeJson(context.io, report);
}

function candidateStatus(value: string | undefined): CastingCandidateStatus {
  const status = requiredFlag(value, '--status');
  if ((CASTING_CANDIDATE_STATUSES as readonly string[]).includes(status)) {
    return status as CastingCandidateStatus;
  }
  throw new StructuredError({
    code: 'CLI041',
    message: `Unknown casting candidate status: ${status}.`,
    issues: [createDiagnosticError('CLI041', 'Unknown casting candidate status.', { path: ['--status'], context: 'renku CLI arguments' }, 'Use candidate, shortlisted or hidden.')],
  });
}

function unknownCommand(input: string[]): StructuredError {
  return new StructuredError({
    code: 'CLI101',
    message: 'Unknown cast casting command.',
    issues: [
      createDiagnosticError(
        'CLI101',
        'Unknown cast casting command.',
        { path: ['cast', ...input] },
        'Use looks show|validate|write, wardrobe show|validate|write, casting round create, casting show, or casting candidate status.'
      ),
    ],
    suggestion: 'Use a supported cast casting command.',
  });
}
