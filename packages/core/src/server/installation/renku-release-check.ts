import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { StructuredError } from '@gorenku/studio-diagnostics';
import type { RenkuUpdateStatus } from '../../client/renku-update.js';
import { readRenkuInstallation } from './installation-paths.js';

interface RenkuReleaseCheckOptions {
  executable?: string;
  platform?: typeof process.platform;
  downloadBaseUrl?: string;
  fetcher?: typeof fetch;
}

const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const targetPattern = /^(darwin-(arm64|x64)|win32-x64)$/;

export function checkRenkuUpdate(): Promise<RenkuUpdateStatus> {
  return checkRenkuUpdateWithOptions({});
}

export async function checkRenkuUpdateWithOptions(options: RenkuReleaseCheckOptions): Promise<RenkuUpdateStatus> {
  const executable = options.executable ?? process.execPath;
  const platform = options.platform ?? process.platform;
  if (platform !== 'darwin' && platform !== 'win32') {
    return { state: 'notInstalled' };
  }

  const productRoot = path.resolve(path.dirname(executable), platform === 'win32' ? '../..' : '../../..');
  const releasePath = path.join(productRoot, 'RELEASE.json');
  if (!existsSync(releasePath)) {
    if (existsSync(path.join(productRoot, 'INSTALLATION.json'))) {
      throw updateCheckError('UPDATE005', 'Installed Renku release metadata is missing.');
    }
    return { state: 'notInstalled' };
  }
  readRenkuInstallation(executable, platform);

  let installed: unknown;
  try {
    installed = JSON.parse(readFileSync(releasePath, 'utf8'));
  } catch {
    throw updateCheckError('UPDATE005', 'Installed Renku release metadata cannot be read.');
  }
  if (!installed || typeof installed !== 'object' || Array.isArray(installed)) {
    throw updateCheckError('UPDATE005', 'Installed Renku release metadata is invalid.');
  }
  const installedRelease = installed as Record<string, unknown>;
  if (installedRelease.product !== 'renku' || !validVersion(installedRelease.version) ||
      typeof installedRelease.target !== 'string' || !targetPattern.test(installedRelease.target) ||
      !installedRelease.target.startsWith(`${platform}-`)) {
    throw updateCheckError('UPDATE005', 'Installed Renku release metadata is invalid.');
  }

  const origin = resolveDownloadOrigin(options.downloadBaseUrl ?? process.env.RENKU_DOWNLOAD_BASE_URL);
  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(new URL('/studio/channels/beta/release.json', origin), {
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
  } catch {
    throw updateCheckError('UPDATE006', 'Renku could not reach the beta release manifest.');
  }
  if (!response.ok) {
    throw updateCheckError('UPDATE006', `Renku beta release check failed (HTTP ${response.status}).`);
  }

  let manifest: unknown;
  try {
    manifest = await response.json();
  } catch {
    throw updateCheckError('UPDATE007', 'Renku beta release manifest is not valid JSON.');
  }
  if (!validManifest(manifest, installedRelease.target)) {
    throw updateCheckError('UPDATE007', 'Renku beta release manifest is invalid for this installation.');
  }
  return {
    state: compareVersions(manifest.version, installedRelease.version) > 0 ? 'available' : 'current',
    installedVersion: installedRelease.version,
    publishedVersion: manifest.version,
  };
}

function validVersion(value: unknown): value is string {
  return typeof value === 'string' && versionPattern.test(value);
}

function validManifest(value: unknown, target: string): value is { version: string } {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const manifest = value as Record<string, unknown>;
  if (manifest.product !== 'renku' || manifest.channel !== 'beta' || !validVersion(manifest.version) ||
      !Array.isArray(manifest.artifacts)) {
    return false;
  }
  const artifact = manifest.artifacts.find((entry: unknown) =>
    entry && typeof entry === 'object' && (entry as Record<string, unknown>).target === target
  ) as Record<string, unknown> | undefined;
  const suffix = target.startsWith('win32-') ? 'zip' : 'tar.gz';
  return artifact?.versionKey === `studio/releases/${manifest.version}/${target}/renku.${suffix}` &&
    typeof artifact.sha256 === 'string' && /^[0-9a-f]{64}$/.test(artifact.sha256);
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split('.').map(BigInt);
  const rightParts = right.split('.').map(BigInt);
  for (let index = 0; index < 3; index++) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] > rightParts[index] ? 1 : -1;
    }
  }
  return 0;
}

function resolveDownloadOrigin(configured: string | undefined): URL {
  try {
    const origin = new URL(configured ?? 'https://downloads.gorenku.com');
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
    if ((origin.protocol !== 'https:' && !(loopback && origin.protocol === 'http:')) ||
        origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
      throw new Error();
    }
    return origin;
  } catch {
    throw updateCheckError('UPDATE008', 'Renku download origin is invalid.');
  }
}

function updateCheckError(code: string, message: string): StructuredError {
  return new StructuredError({ code, message });
}
