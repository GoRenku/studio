import { loadCommand } from '../registry.js';
import type { StudioCommandOptions } from './contracts.js';

export async function runStudioCommand(
  options: StudioCommandOptions
): Promise<number> {
  if (options.input[0] === 'start') {
    const { runStudioStartCommand } = await loadCommand('studio', () => import('./start-command.js'));
    return await runStudioStartCommand({
      input: options.input,
      noBrowser: options.noBrowser ?? false,
      io: options.io,
      homeDir: options.homeDir,
    });
  }
  if (options.input[0] === 'stop') {
    const { runStudioStopCommand } = await loadCommand('studio', () => import('./stop-command.js'));
    return await runStudioStopCommand(options);
  }
  if (options.input[0] === 'current') {
    const { runStudioCurrentCommand } = await loadCommand('studio', () => import('./current-command.js'));
    return await runStudioCurrentCommand(options);
  }
  if (options.input[0] === 'server' && options.input[1] === 'status') {
    const { runStudioServerStatusCommand } = await loadCommand('studio', () => import('./server-status-command.js'));
    return await runStudioServerStatusCommand(options);
  }
  if (options.input[0] === 'notify-refresh') {
    const { runStudioNotifyRefreshCommand } = await loadCommand('studio', () => import('./notify-refresh-command.js'));
    return await runStudioNotifyRefreshCommand(options);
  }
  options.io.stderr.error(
    'Usage: renku studio start [--no-browser] OR renku studio stop OR renku studio current --json OR renku studio server status --json OR renku studio notify-refresh --project <project-name> --resource <resource-key> --json'
  );
  return 1;
}
