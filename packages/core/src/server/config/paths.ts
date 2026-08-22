import os from 'node:os';
import path from 'node:path';
import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import { RenkuConfigError } from './errors.js';

export const RENKU_CONFIG_DIR_NAME = 'renku' as const;
export const RENKU_CONFIG_FILE_NAME = 'config.yaml' as const;

export interface RenkuConfigPathOptions {
  homeDir?: string;
  storageRoot?: string;
}

export interface RenkuPlatformPathContext {
  platform: typeof process.platform;
  homeDir: string;
  localAppData?: string;
  xdgConfigHome?: string;
}

export function resolveRenkuConfigDir(
  options: RenkuConfigPathOptions = {}
): string {
  if (options.homeDir) {
    return path.join(options.homeDir, '.config', RENKU_CONFIG_DIR_NAME);
  }
  return resolveRenkuConfigDirForPlatform(currentPlatformPathContext());
}

export function resolveRenkuConfigPath(
  options: RenkuConfigPathOptions = {}
): string {
  return path.join(resolveRenkuConfigDir(options), RENKU_CONFIG_FILE_NAME);
}

export function resolveRecommendedRenkuStorageRoot(
  options: RenkuConfigPathOptions = {}
): string {
  if (options.homeDir) {
    return resolveRecommendedRenkuStorageRootForPlatform({
      ...currentPlatformPathContext(),
      homeDir: options.homeDir,
    });
  }
  return resolveRecommendedRenkuStorageRootForPlatform(
    currentPlatformPathContext()
  );
}

export function resolveRenkuConfigDirForPlatform(
  context: RenkuPlatformPathContext
): string {
  if (context.platform === 'win32') {
    const localAppData = context.localAppData?.trim();
    if (!localAppData || !path.win32.isAbsolute(localAppData)) {
      throw new RenkuConfigError(
        'CONFIG014',
        'Renku cannot resolve the native Windows configuration directory.',
        {
          issues: [
            createDiagnosticError(
              'CONFIG014',
              'LOCALAPPDATA must be an absolute native Windows path.',
              { path: ['LOCALAPPDATA'], context: 'Renku configuration' }
            ),
          ],
          suggestion:
            'Ensure LOCALAPPDATA points to an absolute local application-data directory, then start Renku again.',
        }
      );
    }
    return path.win32.join(localAppData, 'Renku', 'Studio');
  }

  if (context.platform === 'darwin') {
    return path.join(context.homeDir, '.config', RENKU_CONFIG_DIR_NAME);
  }

  const xdgConfigHome = context.xdgConfigHome?.trim();
  const configHome =
    xdgConfigHome && path.isAbsolute(xdgConfigHome)
      ? xdgConfigHome
      : path.join(context.homeDir, '.config');
  return path.join(configHome, RENKU_CONFIG_DIR_NAME);
}

export function resolveRecommendedRenkuStorageRootForPlatform(
  context: RenkuPlatformPathContext
): string {
  if (context.platform === 'win32') {
    return path.win32.join(context.homeDir, 'Videos', 'Renku');
  }
  return path.join(
    context.homeDir,
    context.platform === 'darwin' ? 'Movies' : 'Videos',
    'Renku'
  );
}

function currentPlatformPathContext(): RenkuPlatformPathContext {
  return {
    platform: process.platform,
    homeDir: os.homedir(),
    localAppData: process.env.LOCALAPPDATA,
    xdgConfigHome: process.env.XDG_CONFIG_HOME,
  };
}
