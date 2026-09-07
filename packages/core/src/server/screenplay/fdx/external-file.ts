import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { eq } from 'drizzle-orm';
import type { FdxUpdateStatus } from '../../../client/screenplay/fdx-updates.js';
import type { RenkuConfigPathOptions } from '../../config/index.js';
import { openProjectSession } from '../../database/lifecycle/active-session.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import { normalizeProjectRelativePath, resolveProjectRelativePath } from '../../files/project-relative-paths.js';
import { ProjectDataError } from '../../project-data-error.js';
import { assetFiles, assets } from '../../schema/assets.js';
import { readScreenplayImport, requireImportSourceSha256 } from './persistence/import-record.js';
import { readFdxSourceBytes } from './source.js';

export type FdxUpdateProjectInput = RenkuConfigPathOptions & { projectName: string };

export function resolveFdxExportPath(session: DatabaseSession, projectFolder: string): string {
  const root = fs.realpathSync(projectFolder);
  let current = root;
  for (const segment of ['screenplay', 'edit', 'script.fdx']) {
    current = path.join(current, segment);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') {
        continue;
      }
      throw new ProjectDataError('SCREENPLAY_FDX_SOURCE_UNREADABLE', `Cannot inspect export path: ${current}.`);
    }
    const correctKind = segment === 'script.fdx' ? stat.isFile() : stat.isDirectory();
    if (stat.isSymbolicLink() || !correctKind) {
      throw invalidExportPath(current);
    }
    if (!realExportSegment(current).startsWith(`${root}${path.sep}`)) {
      throw invalidExportPath(current);
    }
    if (segment === 'script.fdx' && stat.nlink > 1) {
      assertNotRetainedSource(session, root, current, stat);
    }
  }
  return current;
}

function realExportSegment(segment: string): string {
  try {
    return fs.realpathSync(segment);
  } catch (error) {
    const changing = (error as { code?: string }).code === 'ENOENT';
    throw new ProjectDataError(changing ? 'SCREENPLAY_FDX_SOURCE_CHANGED' : 'SCREENPLAY_FDX_SOURCE_UNREADABLE',
      `Cannot resolve the current export path: ${segment}.`);
  }
}

function assertNotRetainedSource(session: DatabaseSession, root: string, exportPath: string, stat: fs.Stats): void {
  const retained = session.db.select({ path: assetFiles.projectRelativePath }).from(assetFiles)
    .innerJoin(assets, eq(assets.id, assetFiles.assetId)).where(eq(assets.type, 'screenplay_source')).all();
  for (const file of retained) {
    let source;
    try {
      source = fs.statSync(resolveProjectRelativePath(root, normalizeProjectRelativePath(file.path)));
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') {
        continue;
      }
      throw new ProjectDataError('SCREENPLAY_FDX_SOURCE_UNREADABLE', 'Cannot verify retained source separation.');
    }
    if (source.dev === stat.dev && source.ino === stat.ino) {
      throw invalidExportPath(exportPath);
    }
  }
}

function invalidExportPath(exportPath: string): ProjectDataError {
  return new ProjectDataError('SCREENPLAY_FDX_EXPORT_PATH_INVALID',
    `External export must be a separate regular file with no symlinked path segments: ${exportPath}.`);
}

export function requireFdxImport(session: DatabaseSession) {
  const currentImport = readScreenplayImport(session);
  if (!currentImport) {
    throw new ProjectDataError('SCREENPLAY_FDX_UPDATE_NOT_APPLICABLE', 'This Project has no accepted FDX screenplay.');
  }
  return currentImport;
}

export async function prepareFdxExportFolder(input: FdxUpdateProjectInput): Promise<{ exportPath: string }> {
  const { session, projectFolder } = await openProjectSession(input);
  try {
    requireFdxImport(session);
    const exportPath = resolveFdxExportPath(session, projectFolder);
    for (const directory of [path.dirname(path.dirname(exportPath)), path.dirname(exportPath)]) {
      resolveFdxExportPath(session, projectFolder);
      try {
        fs.mkdirSync(directory);
      } catch (error) {
        if ((error as { code?: string }).code !== 'EEXIST') {
          throw new ProjectDataError('SCREENPLAY_FDX_SOURCE_UNREADABLE', `Cannot create export folder: ${directory}.`);
        }
      }
    }
    return { exportPath: resolveFdxExportPath(session, projectFolder) };
  } finally {
    session.close();
  }
}

export async function readStableFdxExport(session: DatabaseSession, projectFolder: string, acceptedHash: string) {
  const exportPath = resolveFdxExportPath(session, projectFolder);
  const first = readFdxSourceBytes(exportPath);
  resolveFdxExportPath(session, projectFolder);
  const sha256 = createHash('sha256').update(first).digest('hex');
  if (sha256 === acceptedHash) {
    return { exportPath, bytes: first, sha256 };
  }
  await setTimeout(750);
  const second = readFdxSourceBytes(resolveFdxExportPath(session, projectFolder));
  resolveFdxExportPath(session, projectFolder);
  if (createHash('sha256').update(second).digest('hex') !== sha256) {
    throw new ProjectDataError('SCREENPLAY_FDX_SOURCE_CHANGED', 'FDX export is still settling.');
  }
  return { exportPath, bytes: second, sha256 };
}

export async function readFdxUpdateStatus(input: FdxUpdateProjectInput): Promise<FdxUpdateStatus> {
  const { session, projectFolder } = await openProjectSession(input);
  try {
    const currentImport = readScreenplayImport(session);
    if (!currentImport) {
      return { state: 'notApplicable' };
    }
    const common = {
      exportPath: path.join(projectFolder, 'screenplay/edit/script.fdx'),
      acceptedSourceSha256: requireImportSourceSha256(session, currentImport),
    };
    try {
      const source = await readStableFdxExport(session, projectFolder, common.acceptedSourceSha256);
      // No transaction spans settling. Re-read the accepted baseline after it.
      common.acceptedSourceSha256 = requireImportSourceSha256(session, requireFdxImport(session));
      return { ...common, state: source.sha256 === common.acceptedSourceSha256 ? 'current' : 'pending', sourceSha256: source.sha256 };
    } catch (error) {
      if (!(error instanceof ProjectDataError)) {
        throw error;
      }
      if (error.code === 'SCREENPLAY_FDX_SOURCE_NOT_FOUND') {
        return { ...common, state: 'missing' };
      }
      if (error.code === 'SCREENPLAY_FDX_SOURCE_CHANGED') {
        return { ...common, state: 'settling' };
      }
      return { ...common, state: 'unavailable', diagnostics: [{
        code: error.code, message: error.message, severity: 'error', location: { path: ['screenplay', 'export'] },
      }] };
    }
  } finally {
    session.close();
  }
}
