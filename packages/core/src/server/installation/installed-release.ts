import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { StructuredError } from '@gorenku/studio-diagnostics';
import { readRenkuInstallation } from './installation-paths.js';

export interface InstalledRenkuReleaseOptions {
  executable?: string;
  platform?: typeof process.platform;
}

export interface InstalledRenkuRelease {
  version: string;
  target: string;
}

export const RENKU_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const targetPattern = /^(darwin-(arm64|x64)|win32-x64)$/;

/**
 * Reads `RELEASE.json` of an installed Renku. Returns null when this process is
 * not an installed Renku (a source checkout, or Linux); throws UPDATE005 when
 * installed release metadata is missing or broken.
 */
export function readInstalledRenkuRelease(
  options: InstalledRenkuReleaseOptions = {}
): InstalledRenkuRelease | null {
  const executable = options.executable ?? process.execPath;
  const platform = options.platform ?? process.platform;
  if (platform !== 'darwin' && platform !== 'win32') {
    return null;
  }

  const productRoot = path.resolve(path.dirname(executable), platform === 'win32' ? '../..' : '../../..');
  const releasePath = path.join(productRoot, 'RELEASE.json');
  if (!existsSync(releasePath)) {
    if (existsSync(path.join(productRoot, 'INSTALLATION.json'))) {
      throw installedReleaseError('Installed Renku release metadata is missing.');
    }
    return null;
  }
  readRenkuInstallation(executable, platform);

  let installed: unknown;
  try {
    installed = JSON.parse(readFileSync(releasePath, 'utf8'));
  } catch {
    throw installedReleaseError('Installed Renku release metadata cannot be read.');
  }
  if (!installed || typeof installed !== 'object' || Array.isArray(installed)) {
    throw installedReleaseError('Installed Renku release metadata is invalid.');
  }
  const release = installed as Record<string, unknown>;
  if (release.product !== 'renku' || typeof release.version !== 'string' ||
      !RENKU_VERSION_PATTERN.test(release.version) ||
      typeof release.target !== 'string' || !targetPattern.test(release.target) ||
      !release.target.startsWith(`${platform}-`)) {
    throw installedReleaseError('Installed Renku release metadata is invalid.');
  }
  return { version: release.version, target: release.target };
}

function installedReleaseError(message: string): StructuredError {
  return new StructuredError({ code: 'UPDATE005', message });
}
