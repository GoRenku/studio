import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  GarbageCollectionReport,
  ProjectRelativePath,
  TrashItem,
  TrashProjectReport,
} from '../../client/index.js';
import {
  joinProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';

export interface EmptyTrashManifestInput {
  projectFolder: string;
  project: TrashProjectReport;
  operationId: string;
  items: TrashItem[];
  files: GarbageCollectionReport['files'];
  createdAt: string;
  dryRun: boolean;
}

export async function writeTrashManifest(
  input: EmptyTrashManifestInput
): Promise<string> {
  const manifestProjectRelativePath = trashManifestProjectRelativePath(input.operationId);
  const manifestPath = resolveProjectRelativePath(
    input.projectFolder,
    manifestProjectRelativePath
  );
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        version: 1,
        operationId: input.operationId,
        project: input.project,
        createdAt: input.createdAt,
        dryRun: input.dryRun,
        items: input.items,
        files: input.files,
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return manifestProjectRelativePath;
}
export function trashManifestProjectRelativePath(operationId: string): ProjectRelativePath {
  return joinProjectRelativePath(
    '.renku',
    'trash',
    'emptied',
    operationId,
    'manifest.json'
  );
}
