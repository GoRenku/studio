import {
  createDiagnosticError,
  StructuredError,
} from '@gorenku/studio-diagnostics';
import {
  createProjectDataService,
  type CastVoiceAttachmentDocument,
  type CastDesignDocument,
  type CastOperationDocument,
} from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../cli.js';
import {
  readRequiredJsonInput,
  requiredFlag,
  writeJson,
} from './department-command-io.js';
import { appendStudioResourceChangedEvent } from './studio-resource-event-command.js';

export async function runCastCommand(options: {
  input: string[];
  flags: {
    file?: string;
    project?: string;
    cast?: string;
    voice?: string;
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
    if (nested === 'list') {
      writeJson(
        options.io,
        await service.listCastVoices({
          homeDir: options.homeDir,
          projectName: options.flags.project,
          castMemberId: requiredFlag(options.flags.cast, '--cast'),
        })
      );
      return 0;
    }
    if (nested === 'show') {
      writeJson(
        options.io,
        await service.readCastVoice({
          homeDir: options.homeDir,
          projectName: options.flags.project,
          castMemberId: requiredFlag(options.flags.cast, '--cast'),
          voiceIdOrName: requiredFlag(options.flags.voice, '--voice'),
        })
      );
      return 0;
    }
    if (nested === 'validate') {
      const filePath = requiredFlag(options.flags.file, '--file');
      const document = await readRequiredJsonInput(filePath, 'cast voice validate');
      writeJson(
        options.io,
        await service.validateCastVoiceAttachment({
          homeDir: options.homeDir,
          projectName: options.flags.project,
          document: document as CastVoiceAttachmentDocument,
        })
      );
      return 0;
    }
    if (nested === 'attach') {
      const filePath = requiredFlag(options.flags.file, '--file');
      const document = await readRequiredJsonInput(filePath, 'cast voice attach');
      const report = await service.attachCastVoice({
        homeDir: options.homeDir,
        projectName: options.flags.project,
        document: document as CastVoiceAttachmentDocument,
      });
      await appendStudioResourceChangedEvent({
        runtime: cliRuntime(options, service),
        report,
        command: 'cast voice attach',
      });
      writeJson(options.io, report);
      return 0;
    }
    if (nested === 'remove') {
      const report = await service.removeCastVoice({
        homeDir: options.homeDir,
        projectName: options.flags.project,
        castMemberId: requiredFlag(options.flags.cast, '--cast'),
        voiceIdOrName: requiredFlag(options.flags.voice, '--voice'),
      });
      await appendStudioResourceChangedEvent({
        runtime: cliRuntime(options, service),
        report,
        command: 'cast voice remove',
      });
      writeJson(options.io, report);
      return 0;
    }
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

function cliRuntime(
  options: {
    json: boolean;
    io: RenkuCliIo;
    homeDir?: string;
  },
  projectDataService: ReturnType<typeof createProjectDataService>
) {
  return {
    homeDir: options.homeDir,
    json: options.json,
    io: options.io,
    projectDataService,
  };
}
