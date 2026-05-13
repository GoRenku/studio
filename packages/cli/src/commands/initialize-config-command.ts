import {
  StructuredError,
  createDiagnosticError,
} from '@gorenku/studio-diagnostics';
import { initRenkuConfig } from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../cli.js';

export interface RunInitCommandOptions {
  input: string[];
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}

export async function runInitCommand(
  options: RunInitCommandOptions
): Promise<number> {
  const [storageRoot, ...extraInput] = options.input;

  if (!storageRoot) {
    throw new StructuredError({
      code: 'CLI003',
      message: 'Missing required storage root. Usage: renku init <storage-root>',
      issues: [
        createDiagnosticError(
          'CLI003',
          'Missing required storage root.',
          { path: ['init', '<storage-root>'], context: 'renku CLI arguments' },
          'Run renku init <storage-root> with an explicit storage directory.'
        ),
      ],
    });
  }

  if (extraInput.length > 0) {
    throw new StructuredError({
      code: 'CLI004',
      message: `Unexpected extra arguments: ${extraInput.join(' ')}`,
      issues: [
        createDiagnosticError(
          'CLI004',
          `Unexpected extra arguments: ${extraInput.join(' ')}`,
          { path: ['init'], context: 'renku CLI arguments' },
          'Run renku init with exactly one storage root argument.'
        ),
      ],
    });
  }

  const result = await initRenkuConfig(storageRoot, {
    homeDir: options.homeDir,
  });

  if (options.json) {
    options.io.stdout.log(
      JSON.stringify(
        {
          status: result.status,
          configPath: result.configPath,
          storageRoot: result.storageRoot,
        },
        null,
        2
      )
    );
    return 0;
  }

  if (result.status === 'created') {
    options.io.stdout.log('Renku config created.');
  } else {
    options.io.stdout.log('Renku config already exists.');
  }
  options.io.stdout.log(`Config: ${result.configPath}`);
  options.io.stdout.log(`Storage root: ${result.storageRoot}`);

  return 0;
}
