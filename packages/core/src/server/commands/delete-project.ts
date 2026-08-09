import fs from 'node:fs/promises';
import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import type { ProjectDeleteReport } from '../../client/index.js';
import {
  closeCurrentProject,
  readCurrentProject,
} from '../database/lifecycle/current-project.js';
import {
  isPathInside,
  resolveProjectDatabasePath,
  resolveProjectFolder,
} from '../files/project-paths.js';
import { ProjectDataError } from '../project-data-error.js';
import type { DeleteProjectInput } from '../project-data-service-contracts.js';
import { resolveRenkuStorageRoot } from '../renku-config.js';
import { validateProjectName } from './project-name-validation.js';

export async function deleteProject(
  input: DeleteProjectInput
): Promise<ProjectDeleteReport> {
  validateProjectName(input.projectName);
  validateProjectDeletionConfirmation(input);

  const storageRoot = await resolveRenkuStorageRoot(input);
  const projectFolder = resolveProjectFolder(storageRoot, input.projectName);
  if (!isPathInside(storageRoot, projectFolder)) {
    throw new ProjectDataError(
      'PROJECT_DATA025',
      `Project folder must stay inside the configured storage root: ${projectFolder}`
    );
  }
  if (!(await isFile(resolveProjectDatabasePath(projectFolder)))) {
    throw new ProjectDataError(
      'PROJECT_DATA020',
      `Project database not found for deletion: ${projectFolder}`,
      {
        issues: [
          createDiagnosticError(
            'PROJECT_DATA020',
            `Project does not exist: ${input.projectName}`,
            { path: ['projectName'], context: 'Project deletion' },
            'Refresh the Project Library and choose an existing Project.'
          ),
        ],
        suggestion: 'Refresh the Project Library and choose an existing Project.',
      }
    );
  }

  try {
    await fs.rm(projectFolder, { recursive: true });
  } catch (error) {
    throw new ProjectDataError(
      'PROJECT_DATA026',
      `Project could not be deleted: ${projectFolder}`,
      {
        issues: [
          createDiagnosticError(
            'PROJECT_DATA026',
            error instanceof Error ? error.message : 'Project deletion failed.',
            { path: ['projectName'], context: 'Project deletion' },
            'Check filesystem permissions and try again.'
          ),
        ],
        suggestion: 'Check filesystem permissions and try again.',
      }
    );
  }

  const currentProject = await readCurrentProject(input);
  if (currentProject?.projectFolder === projectFolder) {
    await closeCurrentProject(input);
  }

  return {
    projectName: input.projectName,
    projectPath: projectFolder,
    deleted: true,
  };
}

function validateProjectDeletionConfirmation(input: DeleteProjectInput): void {
  if (input.confirmationProjectName !== input.projectName) {
    throw new ProjectDataError(
      'PROJECT_DATA027',
      'Project deletion confirmation does not match the Project name.',
      {
        issues: [
          createDiagnosticError(
            'PROJECT_DATA027',
            'Type the exact Project name to confirm deletion.',
            { path: ['confirmationProjectName'], context: 'Project deletion' },
            `Type ${input.projectName} exactly.`
          ),
        ],
        suggestion: `Type ${input.projectName} exactly.`,
      }
    );
  }
}

async function isFile(filePath: string): Promise<boolean> {
  try {
    return (await fs.stat(filePath)).isFile();
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}
