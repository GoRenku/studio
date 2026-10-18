#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { GrowthReportError } from './errors.mjs';
import { launchAgentPlist } from './launch-agent-plist.mjs';

const LABEL = 'com.gorenku.growth-report';
const DAILY_RUN = { hour: 9, minute: 17 };

export function installLaunchAgent({ platform, homeDirectory, repositoryRoot, nodePath, uid, runCommand, writeFile, fileExists, stdout }) {
  if (platform !== 'darwin') {
    throw scheduleError(`The daily schedule uses macOS launchd; this machine is ${platform}.`, 'Run pnpm growth:schedule on the Mac that keeps the repository .env.');
  }
  if (!fileExists(path.join(repositoryRoot, '.env'))) {
    throw scheduleError(`${path.join(repositoryRoot, '.env')} does not exist.`, 'Add the four growth report settings to .env first (see docs/operations/growth-report.md).');
  }
  const plistPath = path.join(homeDirectory, 'Library', 'LaunchAgents', `${LABEL}.plist`);
  const logPath = path.join(homeDirectory, 'Library', 'Logs', 'renku-growth-report.log');
  writeFile(plistPath, launchAgentPlist({ label: LABEL, nodePath, repositoryRoot, logPath, ...DAILY_RUN }));
  // Not loaded yet is the normal first-install case, so this result is ignored.
  runCommand('launchctl', ['bootout', `gui/${uid}/${LABEL}`]);
  const bootstrap = runCommand('launchctl', ['bootstrap', `gui/${uid}`, plistPath]);
  if (bootstrap.status !== 0) {
    throw scheduleError(
      `launchctl bootstrap exited with ${bootstrap.status}: ${`${bootstrap.stdout}${bootstrap.stderr}`.trim().slice(0, 300)}`,
      `Check ${plistPath} with plutil -lint, then run pnpm growth:schedule again.`
    );
  }
  const time = `${String(DAILY_RUN.hour).padStart(2, '0')}:${String(DAILY_RUN.minute).padStart(2, '0')}`;
  stdout.write(`Growth report scheduled daily at ${time} local time.\nSchedule: ${plistPath}\nLog: ${logPath}\n`);
}

function scheduleError(message, suggestion) {
  return new GrowthReportError('GROWTH009', `The daily schedule was not installed. ${message}`, suggestion);
}

function writeFileAtomically(filePath, contents) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  writeFileSync(temporaryPath, contents);
  renameSync(temporaryPath, filePath);
}

function runCommand(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? result.error?.message ?? '' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    installLaunchAgent({
      platform: process.platform,
      homeDirectory: os.homedir(),
      repositoryRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'),
      nodePath: process.execPath,
      uid: process.getuid(),
      runCommand,
      writeFile: writeFileAtomically,
      fileExists: existsSync,
      stdout: process.stdout,
    });
  } catch (error) {
    const suggestion = error instanceof GrowthReportError ? `\nSuggestion: ${error.suggestion}` : '';
    process.stderr.write(`[growth-report] ${error instanceof Error ? error.message : String(error)}${suggestion}\n`);
    process.exitCode = 1;
  }
}
