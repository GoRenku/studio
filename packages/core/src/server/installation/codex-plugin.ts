import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { RenkuConfigError } from '../config/errors.js';
import { resolveRenkuConfigDir, type RenkuConfigPathOptions } from '../config/paths.js';

export async function readCodexPluginInstallation(
  options: RenkuConfigPathOptions = {}
): Promise<boolean> {
  const installationPath = path.join(resolveRenkuConfigDir(options), 'codex-plugin.json');
  let contents: string;
  try {
    contents = await fs.readFile(installationPath, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return false;
    }
    throw installationError(installationPath, error);
  }
  try {
    const state: unknown = JSON.parse(contents);
    if (!state || typeof state !== 'object' || Array.isArray(state)
      || typeof (state as Record<string, unknown>).codexPluginInstalled !== 'boolean') {
      throw new TypeError('codexPluginInstalled must be a boolean.');
    }
    return (state as { codexPluginInstalled: boolean }).codexPluginInstalled;
  } catch (error) {
    throw installationError(installationPath, error);
  }
}

export async function recordCodexPluginInstallation(
  installed: boolean,
  options: RenkuConfigPathOptions = {}
): Promise<void> {
  const installationPath = path.join(resolveRenkuConfigDir(options), 'codex-plugin.json');
  const temporaryPath = `${installationPath}.${randomUUID()}.tmp`;
  try {
    if (typeof installed !== 'boolean') {
      throw new TypeError('codexPluginInstalled must be a boolean.');
    }
    await fs.mkdir(path.dirname(installationPath), { recursive: true });
    await fs.writeFile(temporaryPath, `${JSON.stringify({ codexPluginInstalled: installed })}\n`, { flag: 'wx' });
    await fs.rename(temporaryPath, installationPath);
  } catch (error) {
    throw installationError(installationPath, error);
  } finally {
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
  }
}

function installationError(installationPath: string, error: unknown): RenkuConfigError {
  return new RenkuConfigError(
    'CONFIG017',
    `Cannot read or record Codex plugin installation at ${installationPath}: ${error instanceof Error ? error.message : String(error)}`,
    { suggestion: 'Check the installation file and configuration-directory permissions, then rerun Renku installation or update.' }
  );
}
