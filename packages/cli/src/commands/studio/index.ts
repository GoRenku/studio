import { loadCommand } from '../registry.js';
import type { StudioCommandOptions } from './contracts.js';

export async function runStudioCommand(
  options: StudioCommandOptions
): Promise<number> {
  const name = options.input[0] ?? '';
  const command = Object.hasOwn(studioCommands, name) ? studioCommands[name] : undefined;
  if (command) {
    return await command(options);
  }
  options.io.stderr.error(
    'Usage: renku studio start [--no-browser] OR renku studio stop OR renku studio mcp OR renku studio current --json OR renku studio server status --json OR renku studio notify-refresh --project <project-name> --resource <resource-key> --json'
  );
  return 1;
}

const studioCommands: Record<string, (options: StudioCommandOptions) => Promise<number>> = {
  mcp: async (options) => {
    const { runStudioMcpCommand } = await loadCommand('studio', () => import('./mcp-command.js'));
    return await runStudioMcpCommand(options);
  },
  start: async (options) => {
    const { runStudioStartCommand } = await loadCommand('studio', () => import('./start-command.js'));
    return await runStudioStartCommand({
      input: options.input,
      noBrowser: options.noBrowser ?? false,
      io: options.io,
      homeDir: options.homeDir,
    });
  },
  stop: async (options) => {
    const { runStudioStopCommand } = await loadCommand('studio', () => import('./stop-command.js'));
    return await runStudioStopCommand(options);
  },
  current: async (options) => {
    const { runStudioCurrentCommand } = await loadCommand('studio', () => import('./current-command.js'));
    return await runStudioCurrentCommand(options);
  },
  server: async (options) => {
    if (options.input[1] !== 'status') {
      options.io.stderr.error('Usage: renku studio server status --json');
      return 1;
    }
    const { runStudioServerStatusCommand } = await loadCommand('studio', () => import('./server-status-command.js'));
    return await runStudioServerStatusCommand(options);
  },
  'notify-refresh': async (options) => {
    const { runStudioNotifyRefreshCommand } = await loadCommand('studio', () => import('./notify-refresh-command.js'));
    return await runStudioNotifyRefreshCommand(options);
  },
};
