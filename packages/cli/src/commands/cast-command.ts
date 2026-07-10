import {
  createDiagnosticError,
  StructuredError,
} from '@gorenku/studio-diagnostics';
import {
  createProjectDataService,
  type CastDesignDocument,
  type CastOperationDocument,
} from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../cli.js';
import {
  castVoiceCommandHandlers,
  type CastVoiceCommandFlags,
} from './cast-voice-command-handlers.js';
import {
  readRequiredJsonInput,
  requiredFlag,
  writeJson,
} from './department-command-io.js';
import { dispatchCliCommand } from './structured-command.js';
import {
  appendStudioResourceChangedEvent,
  type StudioResourceChangedReport,
} from './studio-resource-event-command.js';

export async function runCastCommand(options: {
  input: string[];
  flags: {
    file?: string;
    project?: string;
    cast?: string;
    voice?: string;
    registration?: string;
    simulate?: boolean;
    design?: string;
    active?: boolean;
    dryRun?: boolean;
  };
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}): Promise<number> {
  const [subcommand, nested] = options.input;
  const service = createProjectDataService();

  if (subcommand === 'list') {
    writeJson(options.io, await service.listCastMembers({ homeDir: options.homeDir }));
    return 0;
  }
  if (subcommand === 'show') {
    writeJson(
      options.io,
      await service.readCastMember({
        homeDir: options.homeDir,
        castMemberId: nested ?? requiredFlag(options.flags.cast, '--cast'),
      })
    );
    return 0;
  }
  if (subcommand === 'context') {
    writeJson(
      options.io,
      await service.readCastContext({
        homeDir: options.homeDir,
        castMemberId: requiredFlag(options.flags.cast, '--cast'),
      })
    );
    return 0;
  }
  if (subcommand === 'validate') {
    const filePath = requiredFlag(options.flags.file, '--file');
    const document = await readRequiredJsonInput(filePath, 'cast validate');
    writeJson(
      options.io,
      await service.validateCastOperations({
        homeDir: options.homeDir,
        document: document as CastOperationDocument,
        filePath: filePath !== '-' ? filePath : undefined,
      })
    );
    return 0;
  }
  if (subcommand === 'apply') {
    const filePath = requiredFlag(options.flags.file, '--file');
    const document = await readRequiredJsonInput(filePath, 'cast apply');
    const report = await service.applyCastOperations({
      homeDir: options.homeDir,
      document: document as CastOperationDocument,
      filePath: filePath !== '-' ? filePath : undefined,
      dryRun: options.flags.dryRun,
    });
    if (!options.flags.dryRun) {
      await appendStudioResourceChangedEvent({
        runtime: cliRuntime(options, service),
        report,
        command: 'cast apply',
      });
    }
    writeJson(options.io, report);
    return 0;
  }
  if (subcommand === 'design') {
    if (nested === 'context') {
      writeJson(
        options.io,
        await service.readCastContext({
          homeDir: options.homeDir,
          castMemberId: requiredFlag(options.flags.cast, '--cast'),
        })
      );
      return 0;
    }
    if (nested === 'list') {
      writeJson(
        options.io,
        await service.listCastDesigns({
          homeDir: options.homeDir,
          castMemberId: requiredFlag(options.flags.cast, '--cast'),
        })
      );
      return 0;
    }
    if (nested === 'show') {
      writeJson(
        options.io,
        await service.readCastDesign({
          homeDir: options.homeDir,
          active: options.flags.active,
          castMemberId: options.flags.cast,
          designId: options.flags.design,
        })
      );
      return 0;
    }
    if (nested === 'validate') {
      const filePath = requiredFlag(options.flags.file, '--file');
      const document = await readRequiredJsonInput(filePath, 'cast design validate');
      writeJson(
        options.io,
        await service.validateCastDesign({
          homeDir: options.homeDir,
          document: document as CastDesignDocument,
          filePath: filePath !== '-' ? filePath : undefined,
        })
      );
      return 0;
    }
    if (nested === 'write') {
      const filePath = requiredFlag(options.flags.file, '--file');
      const document = await readRequiredJsonInput(filePath, 'cast design write');
      const report = await service.writeCastDesign({
        homeDir: options.homeDir,
        document: document as CastDesignDocument,
        filePath: filePath !== '-' ? filePath : undefined,
      });
      await appendStudioResourceChangedEvent({
        runtime: cliRuntime(options, service),
        report,
        command: 'cast design write',
      });
      writeJson(options.io, report);
      return 0;
    }
    if (nested === 'set-active') {
      const report = await service.setActiveCastDesign({
        homeDir: options.homeDir,
        castMemberId: requiredFlag(options.flags.cast, '--cast'),
        designId: requiredFlag(options.flags.design, '--design'),
      });
      await appendStudioResourceChangedEvent({
        runtime: cliRuntime(options, service),
        report,
        command: 'cast design set-active',
      });
      writeJson(options.io, report);
      return 0;
    }
  }
  if (subcommand === 'voice') {
    const runtime = cliRuntime(options, service);
    const result = await dispatchCliCommand({
      commandPath: options.input.slice(1),
      flags: options.flags satisfies CastVoiceCommandFlags,
      runtime,
      handlers: castVoiceCommandHandlers,
      unknownCommand: unknownCastVoiceCommand,
    });
    if (
      nested === 'attach' ||
      nested === 'remove' ||
      (nested === 'registrations' &&
        (options.input[2] === 'create' || options.input[2] === 'remove'))
    ) {
      await appendStudioResourceChangedEvent({
        runtime,
        report: result as StudioResourceChangedReport,
        command: `cast voice ${options.input.slice(1).join(' ')}`,
      });
    }
    writeJson(options.io, result);
    return 0;
  }

  throw new StructuredError({
    code: 'CLI101',
    message: 'Unknown cast command.',
    issues: [
      createDiagnosticError(
        'CLI101',
        'Unknown cast command.',
        { path: ['cast', subcommand ?? ''] },
        'Use list, show, context, validate, apply, design, or voice.'
      ),
    ],
    suggestion: 'Use a supported cast command.',
  });
}

function unknownCastVoiceCommand(commandPath: readonly string[]): StructuredError {
  return new StructuredError({
    code: 'CLI120',
    message: `Unknown cast voice command: ${commandPath.join(' ') || '(none)'}.`,
    suggestion: 'Use cast voice list, show, validate, attach, or remove.',
  });
}

function cliRuntime(
  options: {
    flags: { project?: string };
    json: boolean;
    io: RenkuCliIo;
    homeDir?: string;
  },
  projectDataService: ReturnType<typeof createProjectDataService>
) {
  return {
    projectName: options.flags.project,
    homeDir: options.homeDir,
    json: options.json,
    io: options.io,
    projectDataService,
  };
}
