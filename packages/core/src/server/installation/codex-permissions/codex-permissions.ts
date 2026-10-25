import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { RenkuConfigError } from '../../config/errors.js';
import { resolveRenkuConfigDir, resolveRenkuStateDir, type RenkuConfigPathOptions } from '../../config/paths.js';
import { readCodexPluginInstallation } from '../codex-plugin.js';
import { isRenkuCodexFile, renderRenkuCodexFile } from './renku-codex-file.js';

/**
 * `missing`: no file. `current`: Renku's file with today's content.
 * `outdated`: Renku's file with older content. `foreign`: a file Renku did not write.
 */
export type CodexPermissionsFileState = 'missing' | 'current' | 'outdated' | 'foreign';

export interface CodexPermissionsFile {
  /** The Project Library the permissions apply to. */
  projectLibrary: string;
  path: string;
  state: CodexPermissionsFileState;
  /** The content Renku writes for this machine. */
  contents: string;
}

export type CodexPermissionsInput = RenkuConfigPathOptions & { projectLibrary: string };

export async function readCodexPermissionsFile(input: CodexPermissionsInput): Promise<CodexPermissionsFile> {
  const filePath = codexFilePath(input.projectLibrary);
  const contents = renderRenkuCodexFile({ configDir: resolveRenkuConfigDir(input), stateDir: resolveRenkuStateDir(input) });
  const existing = await readExisting(filePath);
  return { projectLibrary: input.projectLibrary, path: filePath, contents, state: fileState(existing, contents) };
}

/** Writes or refreshes Renku's file; a file Renku did not write is never replaced. */
export async function writeCodexPermissionsFile(input: CodexPermissionsInput): Promise<CodexPermissionsFile> {
  const file = await readCodexPermissionsFile(input);
  if (file.state === 'foreign') {
    throw foreignFileError(file.path);
  }
  if (file.state === 'current') {
    return file;
  }
  const temporaryPath = `${file.path}.${randomUUID()}.tmp`;
  try {
    await fs.mkdir(path.dirname(file.path), { recursive: true });
    await fs.writeFile(temporaryPath, file.contents, { encoding: 'utf8', flag: 'wx' });
    await fs.rename(temporaryPath, file.path);
  } catch (error) {
    throw fileError(file.path, 'write', error);
  } finally {
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
  }
  return { ...file, state: 'current' };
}

/**
 * Sets up Codex permissions for a newly created Project Library when the Renku
 * Codex plugin was installed. A file Renku did not write is reported, never
 * replaced, and never fails setup. Null when the user does not use Codex.
 */
export async function setUpCodexPermissions(input: CodexPermissionsInput): Promise<CodexPermissionsFile | null> {
  if (!(await readCodexPluginInstallation(input))) {
    return null;
  }
  const file = await readCodexPermissionsFile(input);
  return file.state === 'foreign' ? file : writeCodexPermissionsFile(input);
}

/** Refreshes Renku's file when it exists; a missing or foreign file is left alone. */
export async function refreshCodexPermissionsFile(input: CodexPermissionsInput): Promise<CodexPermissionsFile> {
  const file = await readCodexPermissionsFile(input);
  return file.state === 'outdated' ? writeCodexPermissionsFile(input) : file;
}

/** Deletes Renku's file, and its `.codex` folder when that is left empty; a foreign file is never deleted. */
export async function removeCodexPermissionsFile(input: CodexPermissionsInput): Promise<CodexPermissionsFile> {
  const file = await readCodexPermissionsFile(input);
  if (file.state === 'foreign') {
    throw foreignFileError(file.path);
  }
  if (file.state === 'missing') {
    return file;
  }
  try {
    await fs.rm(file.path);
    await fs.rmdir(path.dirname(file.path)).catch(() => {});
  } catch (error) {
    throw fileError(file.path, 'remove', error);
  }
  return { ...file, state: 'missing' };
}

function codexFilePath(projectLibrary: string): string {
  return path.join(projectLibrary, '.codex', 'config.toml');
}

function fileState(existing: string | null, contents: string): CodexPermissionsFileState {
  if (existing === null) {
    return 'missing';
  }
  if (!isRenkuCodexFile(existing)) {
    return 'foreign';
  }
  return existing === contents ? 'current' : 'outdated';
}

async function readExisting(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw fileError(filePath, 'read', error);
  }
}

function foreignFileError(filePath: string): RenkuConfigError {
  return new RenkuConfigError(
    'CODEX_PERMISSIONS001',
    `${filePath} has Codex settings that Renku did not write, so Renku left them unchanged.`,
    { suggestion: 'Add the Renku permissions to that file by hand (see the Codex permissions page on the Renku website), or move it away and run renku codex permissions set.' }
  );
}

function fileError(filePath: string, operation: 'read' | 'write' | 'remove', error: unknown): RenkuConfigError {
  return new RenkuConfigError(
    'CODEX_PERMISSIONS002',
    `Renku could not ${operation} ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    { suggestion: 'Check that the Project Library folder exists and is writable, then try again.' }
  );
}
