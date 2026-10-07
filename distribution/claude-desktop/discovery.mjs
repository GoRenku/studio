import { spawnSync } from 'node:child_process';
import { accessSync, constants, existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const commands = [
  { args: ['list'], flags: ['--json'] },
  { args: ['marketplace', 'list'], flags: ['--json'] },
  { args: ['marketplace', 'add'], flags: [] },
  { args: ['marketplace', 'update'], flags: [] },
  { args: ['install'], flags: ['--scope', '--json'] },
  { args: ['update'], flags: ['--scope', '--json'] },
];

function directories(root) {
  try {
    return readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function macDesktop({ applicationDirectories, execute, env }) {
  for (const root of applicationDirectories) {
    for (const name of directories(root).filter((entry) => entry.endsWith('.app'))) {
      const result = execute('/usr/bin/plutil', ['-extract', 'CFBundleIdentifier', 'raw', '-o', '-', path.join(root, name, 'Contents', 'Info.plist')], { encoding: 'utf8', timeout: 10000, env });
      if (result.error) throw result.error;
      if (result.status === 0 && result.stdout.trim() === 'com.anthropic.claudefordesktop') return true;
    }
  }
  return false;
}

function windowsDesktop({ execute, env }) {
  const script = "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $ErrorActionPreference = 'Stop'; $key = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\AnthropicClaude'; if (Test-Path -LiteralPath $key) { Get-ItemProperty -LiteralPath $key | Select-Object DisplayName,Publisher,InstallLocation | ConvertTo-Json -Compress } else { 'null' }";
  const executable = path.win32.join(env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const result = execute(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { encoding: 'utf8', timeout: 30000, env, windowsHide: true });
  if (result.error || result.status !== 0) throw new Error(`Cannot inspect Claude Desktop registration: ${result.error?.message || result.stderr}`);
  const registration = JSON.parse(result.stdout);
  if (registration === null) return false;
  if (registration.DisplayName !== 'Claude' || registration.Publisher !== 'Anthropic PBC' || typeof registration.InstallLocation !== 'string' || !path.win32.isAbsolute(registration.InstallLocation)) {
    throw new Error('Claude Desktop registration has an unexpected identity or installation location.');
  }
  if (!existsSync(path.join(registration.InstallLocation, 'claude.exe'))) throw new Error('The registered Claude Desktop launcher is missing. Repair Claude Desktop and rerun setup.');
  return true;
}

function compatible(executable, runtime) {
  try {
    accessSync(executable, runtime.platform === 'win32' ? constants.F_OK : constants.X_OK);
  } catch {
    return false;
  }
  const invoke = (args) => runtime.execute(executable, args, { encoding: 'utf8', timeout: 30000, env: runtime.env, windowsHide: true });
  const version = invoke(['--version']);
  if (version.status !== 0 || !/^\d+\.\d+\.\d+\s+\(Claude Code\)/.test(version.stdout?.trim() || '')) return false;
  return commands.every(({ args, flags }) => {
    const result = invoke(['plugin', ...args, '--help']);
    return result.status === 0 && flags.every((flag) => new RegExp(`(?:^|\\s)${flag}(?:[=\\s,]|$)`).test(result.stdout));
  });
}

export function findClaudeDesktopCli({
  platform = process.platform,
  env = process.env,
  home = homedir(),
  execute = spawnSync,
  applicationDirectories = ['/Applications', path.join(home, 'Applications')],
  cacheRoot = platform === 'win32'
    ? path.join(env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Claude', 'claude-code')
    : path.join(home, 'Library', 'Application Support', 'Claude', 'claude-code'),
} = {}) {
  try {
    const runtime = { platform, env, execute, applicationDirectories };
    const detect = { darwin: macDesktop, win32: windowsDesktop }[platform];
    if (!detect || !detect(runtime)) return null;
    const versions = directories(cacheRoot).filter((name) => /^\d+\.\d+\.\d+$/.test(name));
    versions.sort((a, b) => {
      const left = a.split('.').map(Number);
      const right = b.split('.').map(Number);
      return right[0] - left[0] || right[1] - left[1] || right[2] - left[2] || a.localeCompare(b);
    });
    for (const version of versions) {
      for (const hash of directories(path.join(cacheRoot, version))) {
        const executable = path.join(cacheRoot, version, hash, ...(platform === 'win32' ? ['claude.exe'] : ['claude.app', 'Contents', 'MacOS', 'claude']));
        if (compatible(executable, runtime)) return executable;
      }
    }
    throw new Error('Claude Desktop is installed, but no compatible Code runtime was found. Open its Code tab or update Desktop, then rerun Renku setup.');
  } catch (error) {
    throw new Error(`INSTALL013 ${error.message}`, { cause: error });
  }
}
