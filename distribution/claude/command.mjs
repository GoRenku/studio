import path from 'node:path';

export function claudeCommand(executable, args, { env, platform = process.platform }) {
  if (platform !== 'win32' || !/\.(cmd|bat)$/i.test(executable)) return { executable, args };
  const literal = (value) => `'${value.replaceAll("'", "''")}'`;
  const script = `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $ErrorActionPreference = 'Stop'; & ${literal(executable)} ${args.map(literal).join(' ')}; exit $LASTEXITCODE`;
  const powershell = path.win32.join(env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  return { executable: powershell, args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')] };
}
