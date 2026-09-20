import { spawnSync } from 'node:child_process';
import { StructuredError } from '@gorenku/studio-diagnostics';
import { isStudioRuntimeDescriptorUsable, readStudioRuntimeDescriptor } from '../studio-coordination/index.js';
import { readRenkuInstallation } from './installation-paths.js';

export async function updateRenku(scope: 'all' | 'skills'): Promise<void> {
  if (process.platform !== 'darwin' && process.platform !== 'win32') {
    throw new StructuredError({ code: 'UPDATE002', message: 'Renku updates support macOS and Windows.' });
  }
  if (scope === 'all') {
    await assertStudioStopped();
  }
  const installation = readRenkuInstallation(process.execPath, process.platform);
  const windows = process.platform === 'win32';
  const result = spawnSync(windows ? 'powershell.exe' : '/bin/sh', windows
    ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', installation.installer]
    : [installation.installer], {
    stdio: 'inherit',
    env: {
      ...process.env,
      RENKU_UPDATE_SCOPE: scope,
      RENKU_INSTALLED_PRODUCT: installation.productRoot,
      RENKU_INSTALL_ROOT: installation.installRoot,
      RENKU_BIN_ROOT: installation.binRoot,
    },
  });
  if (result.error || result.status !== 0) {
    throw new StructuredError({
      code: 'UPDATE003',
      message: 'Renku update did not complete.',
      suggestion: result.error
        ? `Could not start the installer: ${result.error.message}`
        : 'Review the installer error above and rerun the same update command. A skills failure can occur after the runtime has updated.',
    });
  }
}

async function assertStudioStopped(): Promise<void> {
  const descriptor = await readStudioRuntimeDescriptor({});
  if (descriptor && isStudioRuntimeDescriptorUsable(descriptor, new Date())) {
    throw new StructuredError({
      code: 'UPDATE004',
      message: 'Stop Studio before updating Renku.',
      suggestion: 'Press Ctrl+C in the terminal running Studio, then run renku update again. Skills-only updates can run while Studio is open.',
    });
  }
}
