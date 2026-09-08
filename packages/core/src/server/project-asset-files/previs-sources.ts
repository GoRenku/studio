import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { normalizeProjectRelativePath, resolveProjectRelativePath, joinProjectRelativePath } from '../files/project-relative-paths.js';
import { ProjectDataError } from '../project-data-error.js';
import { assertResolvedPathInsideProject, assertDurableProjectDirectorySync } from './path-guards.js';
import type { ProjectAssetFileWriteSet } from './types.js';

export function inspectPrevisSource(projectFolder: string, sourceDirectory: string) {
  try {
    const root = resolveProjectRelativePath(projectFolder, normalizeProjectRelativePath(sourceDirectory));
    assertResolvedPathInsideProject(fs.realpathSync(projectFolder), fs.realpathSync(root));
    const files: Array<{ relativePath: string; absolutePath: string; hash: string }> = [];
    const digest = createHash('sha256');
    function visit(directory: string, relativeDirectory: string) {
      if (fs.lstatSync(directory).isSymbolicLink()) {
        throw new ProjectDataError('CORE_PREVIS_SOURCE_INVALID', 'Previs source snapshots cannot contain symbolic links.');
      }
      for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const absolutePath = path.join(directory, entry.name);
        const relativePath = path.posix.join(relativeDirectory, entry.name);
        if (entry.isDirectory()) {
          visit(absolutePath, relativePath);
        }
        else if (entry.isFile()) {
          const hash = createHash('sha256').update(fs.readFileSync(absolutePath)).digest('hex');
          digest.update(JSON.stringify([relativePath, hash]));
          files.push({ relativePath, absolutePath, hash });
        } else {
          throw new ProjectDataError('CORE_PREVIS_SOURCE_INVALID', `Unsupported source entry: ${relativePath}.`);
        }
      }
    }
    visit(root, '');
    if (files.length === 0) {
      throw new ProjectDataError('CORE_PREVIS_SOURCE_INVALID', 'Previs source snapshot is empty.');
    }
    return { files, hash: digest.digest('hex') };
  } catch (error) {
    if (error instanceof ProjectDataError) {
      throw error;
    }
    throw new ProjectDataError('CORE_PREVIS_SOURCE_INVALID', `Cannot read Previs source: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function copyPrevisSource(input: {
  projectFolder: string;
  destination: string;
  source: ReturnType<typeof inspectPrevisSource>;
  writeSet: ProjectAssetFileWriteSet;
}) {
  const root = resolveProjectRelativePath(input.projectFolder, normalizeProjectRelativePath(input.destination));
  assertDurableProjectDirectorySync(input.projectFolder, path.dirname(root));
  fs.mkdirSync(path.dirname(root), { recursive: true });
  assertResolvedPathInsideProject(fs.realpathSync(input.projectFolder), fs.realpathSync(path.dirname(root)));
  fs.mkdirSync(root);
  try {
    for (const file of input.source.files) {
      const destination = joinProjectRelativePath(input.destination, file.relativePath);
      const target = resolveProjectRelativePath(input.projectFolder, destination);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(file.absolutePath, target, fs.constants.COPYFILE_EXCL);
      input.writeSet.recordCreatedFile(destination);
      const hash = createHash('sha256').update(fs.readFileSync(target)).digest('hex');
      if (hash !== file.hash) {
        throw new ProjectDataError('CORE_PREVIS_SOURCE_CHANGED', 'Source changed during registration. Retry with a stable snapshot.');
      }
    }
  } catch (error) {
    fs.rmSync(root, { recursive: true, force: true });
    throw error;
  }
}
