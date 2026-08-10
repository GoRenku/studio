import { spawn } from 'node:child_process';

export async function openStudioBrowser(url: string): Promise<boolean> {
  const command =
    process.platform === 'darwin'
      ? { executable: 'open', args: [url] }
      : process.platform === 'win32'
        ? { executable: 'cmd.exe', args: ['/d', '/s', '/c', 'start', '', url] }
        : { executable: 'xdg-open', args: [url] };

  return await new Promise<boolean>((resolve) => {
    const child = spawn(command.executable, command.args, {
      detached: true,
      stdio: 'ignore',
    });
    child.once('error', () => resolve(false));
    child.once('spawn', () => {
      child.unref();
      resolve(true);
    });
  });
}
