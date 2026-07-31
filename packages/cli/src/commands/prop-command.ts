import {
  createDiagnosticError,
  StructuredError,
} from '@gorenku/studio-diagnostics';
import {
  createProjectDataService,
  type PropOperationDocument,
} from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../cli.js';
import {
  readRequiredJsonInput,
  requiredFlag,
  writeJson,
} from './department-command-io.js';
import { appendStudioResourceChangedEvent } from './studio-resource-event-command.js';

export async function runPropCommand(options: {
  input: string[];
  flags: {
    file?: string;
    prop?: string;
    dryRun?: boolean;
  };
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}): Promise<number> {
  const [subcommand, id] = options.input;
  const service = createProjectDataService();
  if (subcommand === 'list') {
    writeJson(options.io, await service.listProps({ homeDir: options.homeDir }));
    return 0;
  }
  if (subcommand === 'show') {
    writeJson(options.io, await service.readProp({
      homeDir: options.homeDir,
      propId: id ?? requiredFlag(options.flags.prop, '--prop'),
    }));
    return 0;
  }
  if (subcommand === 'context') {
    writeJson(options.io, await service.readPropContext({
      homeDir: options.homeDir,
      propId: requiredFlag(options.flags.prop, '--prop'),
    }));
    return 0;
  }
  if (subcommand === 'validate') {
    const filePath = requiredFlag(options.flags.file, '--file');
    const document = await readRequiredJsonInput(filePath, 'prop validate');
    writeJson(options.io, await service.validatePropOperations({
      homeDir: options.homeDir,
      document: document as PropOperationDocument,
      filePath: filePath !== '-' ? filePath : undefined,
    }));
    return 0;
  }
  if (subcommand === 'apply') {
    const filePath = requiredFlag(options.flags.file, '--file');
    const document = await readRequiredJsonInput(filePath, 'prop apply');
    const report = await service.applyPropOperations({
      homeDir: options.homeDir,
      document: document as PropOperationDocument,
      filePath: filePath !== '-' ? filePath : undefined,
      dryRun: options.flags.dryRun,
    });
    if (!options.flags.dryRun) {
      await appendStudioResourceChangedEvent({
        runtime: {
          homeDir: options.homeDir,
          json: options.json,
          io: options.io,
          projectDataService: service,
        },
        report,
        command: 'prop apply',
      });
    }
    writeJson(options.io, report);
    return 0;
  }
  throw new StructuredError({
    code: 'CLI151',
    message: 'Unknown prop command.',
    issues: [
      createDiagnosticError(
        'CLI151',
        'Unknown prop command.',
        { path: ['prop', subcommand ?? ''] },
        'Use list, show, context, validate, or apply.'
      ),
    ],
    suggestion: 'Use a supported prop command.',
  });
}
