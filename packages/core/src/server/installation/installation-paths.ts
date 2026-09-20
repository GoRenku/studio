import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { StructuredError } from '@gorenku/studio-diagnostics';

export function readRenkuInstallation(executable: string, platform: typeof process.platform) {
  const productRoot = path.resolve(path.dirname(executable), platform === 'win32' ? '../..' : '../../..');
  try {
    const installation = JSON.parse(readFileSync(path.join(productRoot, 'INSTALLATION.json'), 'utf8'));
    if (!path.isAbsolute(installation.installRoot) || !path.isAbsolute(installation.binRoot)) {
      throw new TypeError('Installation paths must be absolute.');
    }
    const installer = path.join(productRoot, 'distribution', platform === 'win32' ? 'install.ps1' : 'install.sh');
    if (!existsSync(installer)) {
      throw new TypeError('Bundled installer is missing.');
    }
    return { productRoot, installer, installRoot: installation.installRoot as string, binRoot: installation.binRoot as string };
  } catch {
    throw new StructuredError({
      code: 'UPDATE001',
      message: 'Renku could not locate its installed runtime and update files.',
      suggestion: 'Install Renku using the command at https://gorenku.com/download/, then run renku update from that installation.',
    });
  }
}
