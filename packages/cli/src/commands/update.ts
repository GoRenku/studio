import { updateRenku } from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../cli.js';

export async function runUpdateCommand(input: string[], json: boolean, io: RenkuCliIo): Promise<number> {
  if (json || input.length > 1 || (input.length === 1 && input[0] !== 'skills')) {
    io.stderr.error('Usage: renku update [skills] (interactive terminal; no --json)');
    return 1;
  }
  await updateRenku(input[0] === 'skills' ? 'skills' : 'all');
  return 0;
}
