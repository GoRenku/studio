import type { StudioCommandOptions } from './contracts.js';
import { runStudioCurrentCommand } from './current-command.js';
import { runStudioNotifyRefreshCommand } from './notify-refresh-command.js';
import { runStudioServerStatusCommand } from './server-status-command.js';
import { runStudioStartCommand } from './start-command.js';

export async function runStudioCommand(
  options: StudioCommandOptions
): Promise<number> {
  if (options.input[0] === 'start') {
    return await runStudioStartCommand({
      input: options.input,
      noBrowser: options.noBrowser ?? false,
      io: options.io,
      homeDir: options.homeDir,
    });
  }
  if (options.input[0] === 'current') {
    return await runStudioCurrentCommand(options);
  }
  if (options.input[0] === 'server' && options.input[1] === 'status') {
    return await runStudioServerStatusCommand(options);
  }
  if (options.input[0] === 'notify-refresh') {
    return await runStudioNotifyRefreshCommand(options);
  }
  options.io.stderr.error(
    'Usage: renku studio start [--no-browser] OR renku studio current --json OR renku studio server status --json OR renku studio notify-refresh --project <project-name> --resource <resource-key> --json'
  );
  return 1;
}
