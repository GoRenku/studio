import { spawn, spawnSync } from 'node:child_process';
import { accessSync, constants, existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const pluginCommands = [
  { args: ['list'], flags: ['--json'] },
  { args: ['marketplace', 'list'], flags: ['--json'] },
  { args: ['marketplace', 'add'], flags: ['--json', '--ref'] },
  { args: ['marketplace', 'upgrade'], flags: ['--json'] },
  { args: ['add'], flags: ['--json'] },
];

function failure(message) {
  return new Error(`INSTALL011 ${message}`);
}

function powershellCommand(runtime, script) {
  const executable = path.win32.join(runtime.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const source = '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); ' + script;
  return { executable, args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(source, 'utf16le').toString('base64')] };
}

function powershell(runtime, script) {
  const command = powershellCommand(runtime, script);
  return runtime.execute(command.executable, command.args, {
    encoding: 'utf8', timeout: 120000, env: runtime.env, windowsHide: true,
  });
}

function output(result, operation) {
  if (result.error) throw failure(`${operation}: ${result.error.message}`);
  if (result.status !== 0) throw failure(`${operation}: ${result.stderr || result.stdout || `exit ${result.status}`}`);
  return result.stdout;
}

function cliCommand(runtime, executable, args) {
  if (runtime.platform === 'win32' && /\.(cmd|bat)$/i.test(executable)) {
    const literal = (value) => `'${value.replaceAll("'", "''")}'`;
    return powershellCommand(runtime, `$ErrorActionPreference = 'Stop'; & ${literal(executable)} ${args.map(literal).join(' ')}; exit $LASTEXITCODE`);
  }
  return { executable, args };
}

function invoke(runtime, executable, args) {
  const command = cliCommand(runtime, executable, args);
  return runtime.execute(command.executable, command.args, {
    encoding: 'utf8', timeout: 120000, env: runtime.env, windowsHide: true,
  });
}

function terminalExecutable(runtime) {
  if (runtime.platform === 'win32') {
    // where.exe emits paths in the Windows code page, which can corrupt Unicode names.
    const result = powershell(runtime, 'ConvertTo-Json -Compress -InputObject @(Get-Command -Name codex -CommandType Application -All -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source)');
    const files = JSON.parse(output(result, 'Cannot search PATH for Codex'));
    if (!Array.isArray(files)) throw failure('Codex PATH lookup returned an invalid executable list.');
    return files.find((file) => typeof file === 'string' && /\.(exe|cmd|bat)$/i.test(file));
  }
  for (const directory of (runtime.env.PATH || '').split(path.delimiter)) {
    const executable = path.resolve(directory, 'codex');
    try {
      accessSync(executable, constants.X_OK);
      return executable;
    } catch (error) {
      if (!['ENOENT', 'ENOTDIR', 'EACCES'].includes(error.code)) throw error;
    }
  }
}

function* macDesktopExecutables(runtime) {
  for (const directory of runtime.applicationDirectories) {
    let entries;
    try {
      entries = readdirSync(directory);
    } catch (error) {
      if (['ENOENT', 'EACCES'].includes(error.code)) continue;
      throw error;
    }
    for (const entry of entries.filter((name) => name.endsWith('.app')).sort()) {
      const bundle = path.join(directory, entry);
      const identity = runtime.execute('/usr/bin/plutil', ['-extract', 'CFBundleIdentifier', 'raw', '-o', '-', path.join(bundle, 'Contents', 'Info.plist')], { encoding: 'utf8', timeout: 10000, env: runtime.env });
      if (identity.error) throw failure(`Cannot inspect the application bundle at ${bundle}: ${identity.error.message}`);
      if (identity.status !== 0 || identity.stdout.trim() !== 'com.openai.codex') continue;
      const executable = path.join(bundle, 'Contents', 'Resources', 'codex-cli', 'bin', 'codex');
      if (!existsSync(executable)) throw failure(`Codex Desktop was found at ${bundle}, but its bundled CLI is missing. Update or repair Codex Desktop.`);
      yield executable;
    }
  }
}

function windowsDesktopExecutables(runtime) {
  const result = powershell(runtime, "$ErrorActionPreference = 'Stop'; ConvertTo-Json -Compress -InputObject @(Get-AppxPackage -Name OpenAI.Codex | Select-Object -ExpandProperty InstallLocation)");
  const directories = JSON.parse(output(result, 'Cannot locate the current user’s Codex Desktop package'));
  if (!Array.isArray(directories)) throw failure('Codex Desktop package registration returned an invalid installation list.');
  return directories.map((directory) => {
    if (typeof directory !== 'string' || !path.win32.isAbsolute(directory)) throw failure('Codex Desktop package registration returned an invalid installation location.');
    return path.win32.join(directory, 'app', 'resources', 'codex.exe');
  });
}

function supportsPlugins(runtime, executable) {
  for (const command of pluginCommands) {
    const result = invoke(runtime, executable, ['plugin', ...command.args, '--help']);
    if (result.status !== 0 && /unrecognized subcommand/.test(result.stderr || result.stdout || '')) return false;
    const help = output(result, `Cannot check Codex plugin support at ${executable}`);
    if (!command.flags.every((flag) => new RegExp(`(?:^|\\s)${flag}(?:[=\\s,]|$)`).test(help))) return false;
  }
  return true;
}

function selectExecutable(runtime) {
  const terminal = terminalExecutable(runtime);
  if (terminal && supportsPlugins(runtime, terminal)) return terminal;
  const discover = { darwin: macDesktopExecutables, win32: windowsDesktopExecutables }[runtime.platform];
  for (const executable of discover?.(runtime) || []) {
    if (supportsPlugins(runtime, executable)) return executable;
  }
  throw Object.assign(new Error('No compatible Codex CLI was found on PATH or in Codex Desktop.'), { code: 'ENOENT' });
}

export function createCodexCli({ platform = process.platform, env = process.env, execute = spawnSync, applicationDirectories = ['/Applications', path.join(homedir(), 'Applications')] } = {}) {
  const runtime = { platform, env, execute, applicationDirectories };
  const executable = selectExecutable(runtime);
  return {
    plugin: (args) => JSON.parse(output(invoke(runtime, executable, ['plugin', ...args]), `codex plugin ${args.join(' ')} failed`)),
    startAppServer(cwd) {
      const command = cliCommand(runtime, executable, ['app-server', '--stdio']);
      return spawn(command.executable, command.args, { env, cwd, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    },
  };
}
