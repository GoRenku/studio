import { StructuredError } from '@gorenku/studio-diagnostics';
import { readProviderCredentials } from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../cli.js';

export async function runCredentialsCommand(options: {
  input: string[];
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}): Promise<number> {
  if (options.input.length !== 1 || options.input[0] !== 'status') {
    throw new StructuredError({
      code: 'CLI020',
      message: 'Unknown credentials command. Usage: renku credentials status [--json].',
    });
  }

  const resource = await readProviderCredentials({ homeDir: options.homeDir });
  if (options.json) {
    options.io.stdout.log(JSON.stringify(resource, null, 2));
  } else {
    for (const provider of resource.providers) {
      options.io.stdout.log(
        `${provider.label}: ${provider.configured ? 'configured' : 'not configured'}`
      );
    }
  }
  return 0;
}
