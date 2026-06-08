import {
  createDiagnosticError,
  StructuredError,
} from '@gorenku/studio-diagnostics';
import {
  createProjectDataService,
  type LocationOperationDocument,
} from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../cli.js';
import {
  readRequiredJsonInput,
  requiredFlag,
  writeJson,
} from './department-command-io.js';

export async function runLocationCommand(options: {
  input: string[];
  flags: {
    file?: string;
    location?: string;
    dryRun?: boolean;
  };
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}): Promise<number> {
  const [subcommand, id] = options.input;
  const service = createProjectDataService();

  if (subcommand === 'list') {
    writeJson(options.io, await service.listLocations({ homeDir: options.homeDir }));
    return 0;
  }
  if (subcommand === 'show') {
    writeJson(
      options.io,
      await service.readLocation({
        homeDir: options.homeDir,
        locationId: id ?? requiredFlag(options.flags.location, '--location'),
      })
    );
    return 0;
  }
  if (subcommand === 'context') {
    writeJson(
      options.io,
      await service.readLocationContext({
        homeDir: options.homeDir,
        locationId: requiredFlag(options.flags.location, '--location'),
      })
    );
    return 0;
  }
  if (subcommand === 'validate') {
    const filePath = requiredFlag(options.flags.file, '--file');
    const document = await readRequiredJsonInput(filePath, 'location validate');
    writeJson(
      options.io,
      await service.validateLocationOperations({
        homeDir: options.homeDir,
        document: document as LocationOperationDocument,
        filePath: filePath !== '-' ? filePath : undefined,
      })
    );
    return 0;
  }
  if (subcommand === 'apply') {
    const filePath = requiredFlag(options.flags.file, '--file');
    const document = await readRequiredJsonInput(filePath, 'location apply');
    writeJson(
      options.io,
      await service.applyLocationOperations({
        homeDir: options.homeDir,
        document: document as LocationOperationDocument,
        filePath: filePath !== '-' ? filePath : undefined,
        dryRun: options.flags.dryRun,
      })
    );
    return 0;
  }

  throw new StructuredError({
    code: 'CLI111',
    message: 'Unknown location command.',
    issues: [
      createDiagnosticError(
        'CLI111',
        'Unknown location command.',
        { path: ['location', subcommand ?? ''] },
        'Use list, show, context, validate, or apply.'
      ),
    ],
    suggestion: 'Use a supported location command.',
  });
}
