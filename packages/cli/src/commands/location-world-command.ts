import {
  createProjectDataService,
  type LocationWorldGenerationDocument,
} from '@gorenku/studio-core/server';
import {
  createDiagnosticError,
  StructuredError,
} from '@gorenku/studio-diagnostics';
import type { RenkuCliIo } from '../cli.js';
import { readRequiredJsonInput, requiredFlag, writeJson } from './command-io.js';
import { appendStudioResourceChangedEvent } from './studio-resource-event-command.js';

export async function runLocationWorldCommand(options: {
  input: string[];
  flags: { file?: string; location?: string };
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}): Promise<number> {
  const [subcommand] = options.input;
  const service = createProjectDataService();
  if (subcommand === 'generate') {
    const filePath = requiredFlag(options.flags.file, '--file');
    const document = await readRequiredJsonInput(
      filePath,
      'location world generate'
    );
    const report = await service.generateLocationWorld({
      homeDir: options.homeDir,
      document: document as LocationWorldGenerationDocument,
    });
    await appendStudioResourceChangedEvent({
      runtime: {
        homeDir: options.homeDir,
        json: options.json,
        io: options.io,
        projectDataService: service,
      },
      report,
      command: 'location world generate',
    });
    writeJson(options.io, report);
    return 0;
  }
  if (subcommand === 'show') {
    const locationId = requiredFlag(options.flags.location, '--location');
    writeJson(
      options.io,
      await service.readLocationWorldResource({
        homeDir: options.homeDir,
        locationId,
      })
    );
    return 0;
  }
  throw new StructuredError({
    code: 'CLI164',
    message: 'Unknown Location World command.',
    issues: [
      createDiagnosticError(
        'CLI164',
        'Unknown Location World command.',
        { path: ['location', 'world', subcommand ?? ''] },
        'Use generate or show.'
      ),
    ],
    suggestion: 'Use `renku location world generate` or `renku location world show`.',
  });
}
