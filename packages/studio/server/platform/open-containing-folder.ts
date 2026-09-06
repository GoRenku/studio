import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { createStructuredError } from '@gorenku/studio-diagnostics';

const execute = promisify(execFile);
const launchers: Record<string, string> = {
  darwin: '/usr/bin/open',
  win32: 'explorer.exe',
  linux: 'xdg-open',
};

export async function openContainingFolder(
  absoluteFilePath: string,
  options: {
    platform?: string;
    launch?: (command: string, args: string[]) => Promise<unknown>;
  } = {},
): Promise<void> {
  const command = launchers[options.platform ?? process.platform];
  if (!command) {
    throw createStructuredError({ code: 'STUDIO_FOLDER_OPEN_UNAVAILABLE', message: 'Opening folders is unavailable on this server platform.' });
  }
  const launch = options.launch ?? ((program, args) => execute(program, args, { timeout: 10000 }));
  try {
    await launch(command, [path.dirname(absoluteFilePath)]);
  } catch {
    throw createStructuredError({ code: 'STUDIO_FOLDER_OPEN_FAILED', message: 'The server could not open its file manager. Check that a desktop session is available.' });
  }
}

export function containingFolderActionLabel(): string {
  const labels: Record<string, string> = {
    darwin: 'Open in Finder', win32: 'Open in File Explorer',
  };
  return labels[process.platform] ?? 'Open containing folder';
}
