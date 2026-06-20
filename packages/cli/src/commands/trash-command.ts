import {
  createDiagnosticError,
  StructuredError,
} from '@gorenku/studio-diagnostics';
import { createProjectDataService } from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../cli.js';

export async function runTrashCommand(options: {
  input: string[];
  flags: {
    confirmationToken?: string;
    dryRun: boolean;
    olderThanIso?: string;
    project?: string;
    trashItem?: string;
  };
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}): Promise<number> {
  const [action, nested] = options.input;
  const service = createProjectDataService();
  const projectName = requiredFlag(options.flags.project, '--project');

  if (action === 'list') {
    writeJson(
      options.io,
      await service.listTrash({ projectName, homeDir: options.homeDir })
    );
    return 0;
  }

  if (action === 'restore') {
    writeJson(
      options.io,
      await service.restoreTrashItem({
        projectName,
        homeDir: options.homeDir,
        trashItemId: requiredFlag(options.flags.trashItem, '--trash-item'),
      })
    );
    return 0;
  }

  if (action === 'empty' && nested === 'preview') {
    writeJson(
      options.io,
      await service.previewGarbageCollection({
        projectName,
        homeDir: options.homeDir,
        olderThanIso: options.flags.olderThanIso,
      })
    );
    return 0;
  }

  if (action === 'empty' && nested === 'run') {
    writeJson(
      options.io,
      await service.emptyTrash({
        projectName,
        homeDir: options.homeDir,
        olderThanIso: options.flags.olderThanIso,
        confirmationToken: requiredFlag(
          options.flags.confirmationToken,
          '--confirmation-token'
        ),
        dryRun: options.flags.dryRun,
      })
    );
    return 0;
  }

  throw new StructuredError({
    code: 'CLI120',
    message: 'Unknown trash command.',
    issues: [
      createDiagnosticError(
        'CLI120',
        'Unknown trash command.',
        { path: ['trash', action ?? '', nested ?? ''] },
        'Use list, restore, empty preview, or empty run.'
      ),
    ],
    suggestion: 'Use list, restore, empty preview, or empty run.',
  });
}

function requiredFlag(value: string | undefined, flagName: string): string {
  if (value && value.trim()) {
    return value;
  }
  throw new StructuredError({
    code: 'CLI121',
    message: `Missing required ${flagName} flag.`,
    issues: [
      createDiagnosticError(
        'CLI121',
        `Missing required ${flagName} flag.`,
        { path: [flagName] },
        `Pass ${flagName}.`
      ),
    ],
    suggestion: `Pass ${flagName}.`,
  });
}

function writeJson(io: RenkuCliIo, value: unknown): void {
  io.stdout.log(JSON.stringify(value, null, 2));
}
