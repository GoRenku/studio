import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import { ProjectDataError } from '../project-data-error.js';

export function validateProjectName(projectName: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(projectName)) {
    throw new ProjectDataError(
      'PROJECT_DATA025',
      'Project name must be kebab-case and contain only lowercase letters, numbers, and hyphens.',
      {
        issues: [
          createDiagnosticError(
            'PROJECT_DATA025',
            'Folder name must contain lowercase letters, numbers, and single hyphens only.',
            { path: ['projectName'], context: 'Project command' },
            'Use a Project name such as the-glass-harbor.'
          ),
        ],
        suggestion: 'Use a Project name such as the-glass-harbor.',
      }
    );
  }
}
