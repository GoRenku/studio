import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

export function shellQuote(value) { return `'${value.replaceAll("'", "'\\''")}'`; }
export function powershellQuote(value) { return `'${value.replaceAll("'", "''")}'`; }

export function launchDesktopTerminal(root, name, executable, args, environment) {
  const names = ['HOME', 'ZDOTDIR', 'XDG_CONFIG_HOME', 'FLATPAK_XDG_CONFIG_HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA',
    'CODEX_HOME', 'CLAUDE_CONFIG_DIR', 'VIBE_HOME', 'HERMES_HOME', 'AUTOHAND_HOME', 'GROK_HOME', 'SARVAM_HOME',
    'SHELL', 'PATH', 'RENKU_DOWNLOAD_BASE_URL', 'RENKU_INSTALL_ROOT', 'RENKU_BIN_ROOT'];
  if (process.platform === 'win32') {
    const script = path.join(root, `${name}.ps1`);
    const assignments = names.filter((name) => environment[name] !== undefined)
      .map((name) => `$env:${name} = ${powershellQuote(environment[name])}`).join('\n');
    writeFileSync(script, `${assignments}\n& ${powershellQuote(executable)} ${args.map(powershellQuote).join(' ')}\nif ($LASTEXITCODE) { throw "Rehearsal command failed: $LASTEXITCODE" }\n`);
    execFileSync('powershell.exe', ['-NoProfile', '-Command', `Start-Process powershell.exe -ArgumentList ${powershellQuote(`-NoExit -NoProfile -ExecutionPolicy Bypass -File "${script}"`)}`]);
  } else {
    const script = path.join(root, `${name}.sh`);
    const assignments = names.filter((name) => environment[name] !== undefined).map((name) => `${name}=${shellQuote(environment[name])}`).join(' ');
    writeFileSync(script, `#!/bin/sh\n/usr/bin/env ${assignments} ${[executable, ...args].map(shellQuote).join(' ')}\n`, { mode: 0o700 });
    execFileSync('osascript', ['-e', `tell application "Terminal" to do script ${JSON.stringify(`/bin/sh ${shellQuote(script)}`)}`], { stdio: 'ignore' });
  }
}

export function runInstalledLauncher(launcher, args, environment) {
  if (process.platform === 'win32') {
    return execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
      path.join(path.dirname(launcher), 'renku-launch.ps1'), ...args], { env: environment, encoding: 'utf8' });
  }
  return execFileSync(launcher, args, { env: environment, encoding: 'utf8' });
}

export function retainWindowsUserPath(binRoot) {
  if (process.platform !== 'win32') { return () => {}; }
  const read = "[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false); [Console]::Write((ConvertTo-Json ([Environment]::GetEnvironmentVariable('Path', 'User'))))";
  const original = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-Command', read], { encoding: 'utf8' }));
  const hadEntry = (original ?? '').split(';').some((entry) => entry.toLowerCase() === binRoot.toLowerCase());
  return () => {
    if (hadEntry) { return; }
    // The real installer adds its bin to the user PATH. Remove only this disposable
    // fixture entry, preserving concurrent user edits and every pre-existing entry.
    execFileSync('powershell.exe', ['-NoProfile', '-Command',
      `$current = [Environment]::GetEnvironmentVariable('Path', 'User'); $parts = @($current -split ';' | Where-Object { $_ -ine ${powershellQuote(binRoot)} }); [Environment]::SetEnvironmentVariable('Path', ($parts -join ';'), 'User')`]);
  };
}
