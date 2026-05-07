import { createStudioCoordinationService } from '@gorenku/studio-core/node';
import type { RenkuCliIo } from '../cli.js';

export async function runStudioCurrentCommand(options: {
  input: string[];
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}): Promise<number> {
  if (options.input[0] !== 'current') {
    options.io.stderr.error('Usage: renku studio current --json');
    return 1;
  }
  const current = await createStudioCoordinationService({
    homeDir: options.homeDir,
  }).readStudioCurrent();
  if (options.json) {
    options.io.stdout.log(JSON.stringify(current, null, 2));
  } else {
    options.io.stdout.log(
      current.project
        ? `Current Studio project: ${current.project.name}`
        : 'No active Studio selection is available.'
    );
  }
  return 0;
}
