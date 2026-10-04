import fs from 'node:fs';
import path from 'node:path';
import { createDiagnosticError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { ProjectRelativePath } from '../../../../client/project/index.js';
import { listInspirationFolderRecordsIncludingDiscarded } from '../../access/inspiration-folders.js';
import { isInspirationFolderGarbageCollected } from '../../access/trash.js';
import type { DatabaseSession } from '../store.js';
import { normalizeProjectRelativePath, resolveProjectRelativePath } from '../../../files/project-relative-paths.js';
import { ProjectDataError } from '../../../project-data-error.js';

const imageExtensions = new Set(['.apng', '.avif', '.gif', '.jpeg', '.jpg', '.png', '.webp']);

export interface ReferenceFileCandidate {
  projectRelativePath: ProjectRelativePath;
  ownerKey: string;
  type: 'inspiration_image' | 'research_reference';
}

export function discoverAssetFileBackfillCandidates(input: {
  session: DatabaseSession;
  projectFolder: string;
}): ReferenceFileCandidate[] {
  const candidates: ReferenceFileCandidate[] = [];
  const issues: DiagnosticIssue[] = [];
  let projectRoot: string;
  try {
    projectRoot = fs.realpathSync(input.projectFolder);
  } catch {
    throw new ProjectDataError('PROJECT_ASSET_FILE_BACKFILL_FAILED', 'The Project directory is unavailable.', {
      issues: [createDiagnosticError('PROJECT_ASSET_FILE_BACKFILL_FAILED', 'Cannot read the Project directory.', { path: ['projectFolder'] })],
    });
  }
  const issue = (relativePath: string, message: string) => {
    issues.push(createDiagnosticError(
      'PROJECT_ASSET_FILE_BACKFILL_FAILED',
      message,
      { path: ['projectRelativePath', relativePath] }
    ));
  };

  function scan(relativeDirectory: string, ownerKey: string, inspiration: boolean, optional = false): void {
    try {
      const directory = normalizeProjectRelativePath(relativeDirectory);
      const absolute = resolveProjectRelativePath(projectRoot, directory);
      assertNoSymbolicLinks(projectRoot, directory);
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(absolute, { withFileTypes: true });
      } catch (error) {
        if (optional && isMissingPath(error)) {
          return;
        }
        throw error;
      }
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        const relativePath = normalizeProjectRelativePath(path.posix.join(directory, entry.name));
        if (entry.isSymbolicLink()) {
          issue(relativePath, 'Reference backfill cannot follow symbolic links.');
        } else if (entry.isDirectory()) {
          if (!inspiration) {
            scan(relativePath, ownerKey, false);
          }
        } else if (entry.isFile()) {
          if (!inspiration || imageExtensions.has(path.extname(entry.name).toLowerCase())) {
            candidates.push({
              projectRelativePath: relativePath,
              ownerKey,
              type: inspiration ? 'inspiration_image' : 'research_reference',
            });
          }
        } else {
          issue(relativePath, 'Reference backfill requires regular files and directories.');
        }
      }
    } catch (error) {
      issue(relativeDirectory, `Cannot discover reference files: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  for (const folder of listInspirationFolderRecordsIncludingDiscarded(input.session)) {
    if (folder.discardedAt && folder.discardOperationId && isInspirationFolderGarbageCollected(input.session, {
      folderId: folder.id,
      discardOperationId: folder.discardOperationId,
    })) {
      continue;
    }
    try {
      const directory = normalizeProjectRelativePath(folder.projectRelativePath);
      if (!directory.startsWith('visual-language/inspiration/')) {
        issue(directory, 'Inspiration folders must remain inside visual-language/inspiration/.');
        continue;
      }
      scan(directory, `inspirationFolder:${encodeURIComponent(folder.id)}`, true);
    } catch (error) {
      issue(folder.projectRelativePath, error instanceof Error ? error.message : String(error));
    }
  }
  scan('research', 'project', false, true);
  const ownersByPath = new Map<string, string>();
  for (const candidate of candidates) {
    const owner = ownersByPath.get(candidate.projectRelativePath);
    if (owner !== undefined) {
      issue(candidate.projectRelativePath, 'A retained reference path belongs to more than one folder.');
    }
    ownersByPath.set(candidate.projectRelativePath, candidate.ownerKey);
  }
  if (issues.length > 0) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_BACKFILL_FAILED',
      'Retained reference discovery could not finish.',
      { issues, suggestion: 'Correct the reported reference paths and open the Project again.' }
    );
  }
  return candidates;
}

function assertNoSymbolicLinks(projectRoot: string, relativePath: ProjectRelativePath): void {
  let absolute = projectRoot;
  for (const segment of relativePath.split('/')) {
    absolute = path.join(absolute, segment);
    try {
      if (fs.lstatSync(absolute).isSymbolicLink()) {
        throw new ProjectDataError('PROJECT_ASSET_FILE_BACKFILL_FAILED', 'Reference directories cannot contain symbolic links.');
      }
    } catch (error) {
      if (isMissingPath(error)) {
        return;
      }
      throw error;
    }
  }
}

function isMissingPath(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
