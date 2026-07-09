import { ProjectDataError } from '../project-data-error.js';
import {
  removeCopiedProjectAssetFile,
  removeCopiedProjectAssetFileSync,
} from './persistence.js';
import type { ProjectAssetFileWriteSet } from './types.js';
import type { ProjectRelativePath } from '../../client/index.js';

class ProjectAssetFileWriteSetState implements ProjectAssetFileWriteSet {
  readonly #createdProjectRelativePaths: ProjectRelativePath[] = [];
  #committed = false;

  constructor(readonly projectFolder: string) {}

  get createdProjectRelativePaths(): readonly ProjectRelativePath[] {
    return this.#createdProjectRelativePaths;
  }

  get committed(): boolean {
    return this.#committed;
  }

  recordCreatedFile(projectRelativePath: ProjectRelativePath): void {
    if (this.#committed) {
      throw new ProjectDataError(
        'PROJECT_ASSET_FILE_WRITE_SET_COMMITTED',
        'Project asset file write set is already committed.'
      );
    }
    this.#createdProjectRelativePaths.push(projectRelativePath);
  }

  markCommitted(): void {
    this.#committed = true;
  }
}

export function createProjectAssetFileWriteSet(input: {
  projectFolder: string;
}): ProjectAssetFileWriteSet {
  return new ProjectAssetFileWriteSetState(input.projectFolder);
}

export function commitProjectAssetFileWriteSet(
  writeSet: ProjectAssetFileWriteSet
): void {
  writeSet.markCommitted();
}

export async function rollbackProjectAssetFileWriteSet(
  writeSet: ProjectAssetFileWriteSet
): Promise<void> {
  if (writeSet.committed) {
    return;
  }
  for (const projectRelativePath of [...writeSet.createdProjectRelativePaths].reverse()) {
    await removeCopiedProjectAssetFile(writeSet.projectFolder, projectRelativePath);
  }
}

export function rollbackProjectAssetFileWriteSetSync(
  writeSet: ProjectAssetFileWriteSet
): void {
  if (writeSet.committed) {
    return;
  }
  for (const projectRelativePath of [...writeSet.createdProjectRelativePaths].reverse()) {
    removeCopiedProjectAssetFileSync(writeSet.projectFolder, projectRelativePath);
  }
}
