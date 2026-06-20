import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createDiagnosticError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type { GarbageCollectionReport } from '../../client/index.js';
import {
  joinProjectRelativePath,
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';
import { ProjectDataError } from '../project-data-error.js';

export interface StageTrashFilesInput {
  projectFolder: string;
  operationId: string;
  files: GarbageCollectionReport['files'];
  dryRun: boolean;
}

export async function stageTrashFiles(input: StageTrashFilesInput): Promise<void> {
  const issues = await validateTrashFiles(input);
  if (issues.length > 0) {
    throw new ProjectDataError('PROJECT_DATA281', 'Trash files could not be staged.', {
      issues,
      suggestion:
        'Resolve the reported trash file blockers, then preview and run Empty Trash again.',
    });
  }
  for (const file of input.files) {
    if (input.dryRun) {
      continue;
    }
    const sourcePath = resolveProjectRelativePath(
      input.projectFolder,
      normalizeProjectRelativePath(file.originalProjectRelativePath)
    );
    const targetPath = resolveProjectRelativePath(
      input.projectFolder,
      normalizeProjectRelativePath(file.trashProjectRelativePath)
    );
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.rename(sourcePath, targetPath);
  }
}

async function validateTrashFiles(
  input: StageTrashFilesInput
): Promise<DiagnosticIssue[]> {
  const issues: DiagnosticIssue[] = [];
  for (const file of input.files) {
    pushSafePathIssues(issues, file.originalProjectRelativePath, [
      'trashFile',
      file.trashItemId,
      'originalProjectRelativePath',
    ]);
    pushSafePathIssues(issues, file.trashProjectRelativePath, [
      'trashFile',
      file.trashItemId,
      'trashProjectRelativePath',
    ]);
  }
  if (issues.length > 0) {
    return issues;
  }
  for (const file of input.files) {
    const sourcePath = resolveProjectRelativePath(
      input.projectFolder,
      normalizeProjectRelativePath(file.originalProjectRelativePath)
    );
    try {
      await fs.stat(sourcePath);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'ENOENT') {
        issues.push(
          createDiagnosticError(
            'PROJECT_DATA282',
            `Trash source file was not found: ${file.originalProjectRelativePath}.`,
            { path: ['trashFile', file.trashItemId, 'originalProjectRelativePath'] },
            'Restore or remove the missing file reference before emptying Trash.'
          )
        );
        continue;
      }
      issues.push(
        createDiagnosticError(
          'PROJECT_DATA283',
          `Trash source file could not be inspected: ${file.originalProjectRelativePath}.`,
          { path: ['trashFile', file.trashItemId, 'originalProjectRelativePath'] },
          'Check the file permissions, then preview and run Empty Trash again.'
        )
      );
    }
  }
  return issues;
}

export function trashPackageFilePath(input: {
  operationId: string;
  originalProjectRelativePath: string;
}): string {
  return joinProjectRelativePath(
    '.renku',
    'trash',
    'emptied',
    input.operationId,
    'files',
    normalizeProjectRelativePath(input.originalProjectRelativePath)
  );
}

function pushSafePathIssues(
  issues: DiagnosticIssue[],
  projectRelativePath: string,
  issuePath: string[]
): void {
  let normalized: string;
  try {
    normalized = normalizeProjectRelativePath(projectRelativePath);
  } catch {
    issues.push(
      createDiagnosticError(
        'PROJECT_DATA260',
        `Trash file path must stay inside the project: ${projectRelativePath}.`,
        { path: issuePath },
        'Use a project-relative file path inside the project folder.'
      )
    );
    return;
  }
  if (
    normalized === '.' ||
    normalized.startsWith('../') ||
    path.isAbsolute(projectRelativePath)
  ) {
    issues.push(
      createDiagnosticError(
      'PROJECT_DATA260',
        `Trash file path must stay inside the project: ${projectRelativePath}.`,
        { path: issuePath },
        'Use a project-relative file path inside the project folder.'
      )
    );
  }
}
