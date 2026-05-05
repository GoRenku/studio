import { initRenkuConfig } from '@gorenku/studio-core/node';
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
    options.io.stderr.error(
      'Missing required storage root. Usage: renku init <storage-root>'
    );
    return 1;
  }

  if (extraInput.length > 0) {
    options.io.stderr.error(
      `Unexpected extra arguments: ${extraInput.join(' ')}`
    );
    return 1;
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
