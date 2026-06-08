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
  readRequiredJsonInput,
  requiredFlag,
  writeJson,
} from './department-command-io.js';

export async function runCastCommand(options: {
  input: string[];
  flags: {
    file?: string;
    cast?: string;
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
    writeJson(
      options.io,
      await service.applyCastOperations({
        homeDir: options.homeDir,
        document: document as CastOperationDocument,
        filePath: filePath !== '-' ? filePath : undefined,
        dryRun: options.flags.dryRun,
      })
    );
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
      writeJson(
        options.io,
        await service.writeCastDesign({
          homeDir: options.homeDir,
          document: document as CastDesignDocument,
          filePath: filePath !== '-' ? filePath : undefined,
        })
      );
      return 0;
    }
    if (nested === 'set-active') {
      writeJson(
        options.io,
        await service.setActiveCastDesign({
          homeDir: options.homeDir,
          castMemberId: requiredFlag(options.flags.cast, '--cast'),
          designId: requiredFlag(options.flags.design, '--design'),
        })
      );
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
        'Use list, show, context, validate, apply, or design.'
      ),
    ],
    suggestion: 'Use a supported cast command.',
  });
}
