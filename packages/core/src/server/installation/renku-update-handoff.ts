import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { StructuredError } from '@gorenku/studio-diagnostics';
import type { RenkuUpdateStatus } from '../../client/renku-update.js';
import { readStudioRuntimeDescriptor, resolveStudioRuntimeDescriptorPath } from '../studio-coordination/index.js';
import { readRenkuInstallation } from './installation-paths.js';
import { checkRenkuUpdate } from './renku-release-check.js';

interface RenkuUpdateHandoffOptions {
  check?: () => Promise<RenkuUpdateStatus>;
  launch?: (platform: typeof process.platform, script: string) => boolean;
  platform?: typeof process.platform;
  executable?: string;
  processId?: number;
  readyTimeoutMs?: number;
}

let handoffStarted = false;

export function startRenkuUpdateFromStudio(): Promise<{ started: true; publishedVersion: string }> {
  return startRenkuUpdateFromStudioWithOptions({});
}

export async function startRenkuUpdateFromStudioWithOptions(options: RenkuUpdateHandoffOptions): Promise<{ started: true; publishedVersion: string }> {
  if (handoffStarted) {
    throw handoffError('UPDATE010', 'A Renku update handoff has already started.');
  }
  handoffStarted = true;
  try {
    const platform = options.platform ?? process.platform;
    if (platform !== 'darwin' && platform !== 'win32') {
      throw handoffError('UPDATE002', 'Renku updates support macOS and Windows.');
    }
    const status = await (options.check ?? checkRenkuUpdate)();
    if (status.state !== 'available') {
      throw handoffError('UPDATE009', 'No newer Renku release is available.');
    }
    const installation = readRenkuInstallation(options.executable ?? process.execPath, platform);
    const launcher = path.join(installation.binRoot, platform === 'win32' ? 'renku.cmd' : 'renku');
    if (!existsSync(launcher)) {
      throw handoffError('UPDATE001', 'The installed Renku launcher is missing.');
    }

    const folder = mkdtempSync(path.join(os.tmpdir(), 'renku-update-handoff-'));
    const ready = path.join(folder, 'ready');
    const go = path.join(folder, 'go');
    const script = path.join(folder, platform === 'win32' ? 'update.ps1' : 'update.sh');
    const descriptor = await readStudioRuntimeDescriptor({});
    if (!descriptor || descriptor.pid !== (options.processId ?? process.pid)) {
      throw handoffError('UPDATE012', 'Studio could not confirm its running process before updating.');
    }
    const descriptorPath = resolveStudioRuntimeDescriptorPath({});
    const sourceEnvironment = selectedEnvironment();
    // Windows PowerShell 5.1 needs a BOM to decode Unicode paths as UTF-8.
    writeFileSync(script, platform === 'win32'
      ? `\uFEFF${windowsScript({ launcher, ready, go, descriptorPath, pid: descriptor.pid, environment: sourceEnvironment })}`
      : macScript({ launcher, ready, go, descriptorPath, pid: descriptor.pid, environment: sourceEnvironment }),
    { mode: 0o600 });
    if (platform === 'darwin') {
      chmodSync(script, 0o700);
    }
    if (!(options.launch ?? launchTerminal)(platform, script)) {
      throw handoffError('UPDATE011', 'Renku could not open a terminal for the update.');
    }
    const deadline = Date.now() + (options.readyTimeoutMs ?? 12_000);
    while (!existsSync(ready) && Date.now() < deadline) {
      await delay(100);
    }
    if (!existsSync(ready)) {
      throw handoffError('UPDATE011', 'The update terminal did not start its command.');
    }
    writeFileSync(go, 'go\n', { mode: 0o600 });
    return { started: true, publishedVersion: status.publishedVersion };
  } catch (error) {
    handoffStarted = false;
    throw error;
  }
}

function selectedEnvironment(): Record<string, string | undefined> {
  // Preserve the directory overrides used by the bundled skills installer,
  // including their absence in Studio's environment.
  const names = ['HOME', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA', 'XDG_CONFIG_HOME', 'FLATPAK_XDG_CONFIG_HOME', 'ZDOTDIR', 'SHELL', 'PATH', 'RENKU_DOWNLOAD_BASE_URL',
    'CODEX_HOME', 'CLAUDE_CONFIG_DIR', 'VIBE_HOME', 'HERMES_HOME', 'AUTOHAND_HOME', 'GROK_HOME', 'SARVAM_HOME'];
  const environment = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  environment.HOME ??= os.homedir();
  environment.ZDOTDIR ??= environment.HOME;
  environment.RENKU_DOWNLOAD_BASE_URL ??= 'https://downloads.gorenku.com';
  return environment;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function macScript(input: { launcher: string; ready: string; go: string; descriptorPath: string; pid: number; environment: Record<string, string | undefined> }): string {
  const launcher = shellQuote(input.launcher);
  const restart = `${launcher} studio start`;
  const environment = Object.entries(input.environment).map(([name, value]) => value === undefined ? `unset ${name}` : `export ${name}=${shellQuote(value)}`).join('\n');
  return `#!/bin/sh
${environment}
fail() { printf '%s\\n' "$1"; printf 'Restart manually: %s\\n' ${shellQuote(restart)}; printf '%s' 'Press Return to close this window: '; IFS= read -r answer </dev/tty; exit 1; }
printf ready > ${shellQuote(input.ready)}
count=0
while [ ! -f ${shellQuote(input.go)} ]; do
  count=$((count + 1))
  if [ "$count" -ge 120 ]; then fail 'Update handoff was not confirmed.'; fi
  sleep 0.1
done
printf '%s\\n' 'Stopping Renku Studio…'
if ! ${launcher} studio stop; then fail 'Studio could not stop.'; fi
count=0
while [ -e ${shellQuote(input.descriptorPath)} ] || kill -0 ${input.pid} 2>/dev/null; do
  count=$((count + 1))
  if [ "$count" -ge 300 ]; then fail 'Studio shutdown timed out.'; fi
  sleep 0.1
done
printf '%s\\n' 'Updating Renku…'
if ! ${launcher} update; then fail 'Update did not complete.'; fi
printf '%s\\n' 'Starting Renku Studio…'
if ! ${restart}; then fail 'Studio did not restart.'; fi
`;
}

function powershellQuote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function windowsScript(input: { launcher: string; ready: string; go: string; descriptorPath: string; pid: number; environment: Record<string, string | undefined> }): string {
  const launcher = powershellQuote(input.launcher);
  const restartCommand = `& ${launcher} studio start`;
  const environment = Object.entries(input.environment).map(([name, value]) => `$env:${name} = ${value === undefined ? '$null' : powershellQuote(value)}`).join('\n');
  return `$ErrorActionPreference = 'Stop'
${environment}
Set-Content -LiteralPath ${powershellQuote(input.ready)} -Value ready
for ($i = 0; !(Test-Path -LiteralPath ${powershellQuote(input.go)}); $i++) {
  if ($i -ge 120) { throw 'Update handoff was not confirmed.' }
  Start-Sleep -Milliseconds 100
}
try {
  & ${launcher} studio stop
  if ($LASTEXITCODE -ne 0) { throw 'Studio could not stop.' }
  for ($i = 0; (Test-Path -LiteralPath ${powershellQuote(input.descriptorPath)}) -or (Get-Process -Id ${input.pid} -ErrorAction SilentlyContinue); $i++) {
    if ($i -ge 300) { throw 'Studio shutdown timed out.' }
    Start-Sleep -Milliseconds 100
  }
  & ${launcher} update
  if ($LASTEXITCODE -ne 0) { throw 'Update did not complete.' }
  & ${launcher} studio start
  if ($LASTEXITCODE -ne 0) { throw 'Studio did not restart.' }
} catch {
  Write-Host $_
  Write-Host ${powershellQuote(`Restart manually: ${restartCommand}`)}
  Read-Host 'Press Enter to close this window'
  exit 1
}
`;
}

function launchTerminal(platform: typeof process.platform, script: string): boolean {
  if (platform === 'darwin') {
    const command = `/bin/sh ${shellQuote(script)}`;
    const appleScript = `tell application "Terminal" to do script ${JSON.stringify(command)}`;
    const result = spawnSync('osascript', ['-e', appleScript], { stdio: 'ignore', timeout: 10_000 });
    return !result.error && result.status === 0;
  }
  const argumentsLine = `-NoExit -NoProfile -ExecutionPolicy Bypass -File "${script}"`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command',
    `Start-Process -FilePath 'powershell.exe' -ArgumentList ${powershellQuote(argumentsLine)}`],
  { stdio: 'ignore', timeout: 10_000 });
  return !result.error && result.status === 0;
}

function handoffError(code: string, message: string): StructuredError {
  return new StructuredError({ code, message });
}
