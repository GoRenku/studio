import fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import {
  type RenkuSetup,
  type RenkuSetupInitializationReport,
} from '../../client/renku-setup.js';
import { RenkuConfigError } from './errors.js';
import {
  configFileExists,
  initRenkuConfig,
  readRenkuConfig,
  type InitRenkuConfigOptions,
  type ReadRenkuConfigOptions,
} from './document.js';
import {
  resolveRecommendedRenkuStorageRoot,
  resolveRenkuConfigPath,
} from './paths.js';

export async function readRenkuSetup(
  options: ReadRenkuConfigOptions = {}
): Promise<RenkuSetup> {
  const configPath = options.configPath ?? resolveRenkuConfigPath(options);
  if (!(await configFileExists(configPath))) {
    return {
      status: 'setupRequired',
      recommendedStorageRoot: resolveRecommendedRenkuStorageRoot(options),
    };
  }
  const config = await readRenkuConfig({ ...options, configPath });
  return {
    status: 'configured',
    storageRoot: config.storageRoot,
  };
}

export async function initializeRenkuSetup(
  options: InitRenkuConfigOptions = {}
): Promise<RenkuSetupInitializationReport> {
  const currentSetup = await readRenkuSetup(options);
  if (currentSetup.status === 'configured') {
    return {
      status: 'existing',
      setup: currentSetup,
    };
  }

  await ensureRecommendedStorageRoot(currentSetup.recommendedStorageRoot);
  const result = await initRenkuConfig(
    currentSetup.recommendedStorageRoot,
    options
  );
  return {
    status: result.status,
    setup: {
      status: 'configured',
      storageRoot: result.storageRoot,
    },
  };
}

async function ensureRecommendedStorageRoot(storageRoot: string): Promise<void> {
  try {
    await fs.mkdir(storageRoot, { recursive: true });
    const stats = await fs.stat(storageRoot);
    if (!stats.isDirectory()) {
      throw new RenkuConfigError(
        'CONFIG008',
        `Cannot create Renku storageRoot: ${storageRoot} already exists and is not a directory.`
      );
    }
    await fs.access(storageRoot, fsConstants.R_OK | fsConstants.W_OK);
  } catch (error) {
    if (error instanceof RenkuConfigError) {
      throw error;
    }
    throw new RenkuConfigError(
      'CONFIG015',
      `Renku could not prepare the recommended Project Library at ${storageRoot}.`,
      {
        issues: [
          createDiagnosticError(
            'CONFIG015',
            'The recommended Project Library must be a readable and writable directory.',
            { path: [storageRoot], context: 'First-run setup' }
          ),
        ],
        suggestion:
          'Check the parent directory permissions, then try first-run setup again.',
      }
    );
  }
}
