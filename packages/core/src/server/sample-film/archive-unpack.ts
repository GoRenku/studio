import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { resolveProjectDatabasePath } from '../files/project-paths.js';
import { pathExists } from '../files/path-existence.js';
import { sampleFilmUnpackFailedError } from './sample-film-errors.js';

const execFileAsync = promisify(execFile);
const STDERR_EXCERPT_LENGTH = 400;

/** The system tar that the platform installers already rely on. */
export function systemTarExecutable(platform: typeof process.platform = process.platform): string {
  if (platform === 'win32') {
    return path.win32.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
  }
  return '/usr/bin/tar';
}

export async function unpackArchive(input: {
  tarExecutable: string;
  archivePath: string;
  destination: string;
  projectName: string;
}): Promise<string> {
  try {
    await execFileAsync(input.tarExecutable, ['-xzf', input.archivePath, '-C', input.destination], {
      windowsHide: true,
    });
  } catch (error) {
    throw sampleFilmUnpackFailedError(describeTarFailure(error));
  }

  const projectFolder = path.join(input.destination, input.projectName);
  if (!(await pathExists(resolveProjectDatabasePath(projectFolder)))) {
    throw sampleFilmUnpackFailedError(
      `The archive does not contain the ${input.projectName} project.`
    );
  }
  return projectFolder;
}

function describeTarFailure(error: unknown): string {
  if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
    return 'The system tar program is missing.';
  }
  const stderr = error instanceof Error && 'stderr' in error ? String(error.stderr).trim() : '';
  if (stderr) {
    return `tar reported: ${stderr.slice(0, STDERR_EXCERPT_LENGTH)}`;
  }
  return error instanceof Error ? error.message : String(error);
}
