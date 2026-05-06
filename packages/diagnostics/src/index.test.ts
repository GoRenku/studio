import { describe, expect, it } from 'vitest';
import {
  StructuredError,
  buildDiagnosticResult,
  createDiagnosticError,
  createDiagnosticWarning,
} from './index.js';

describe('studio diagnostics', () => {
  it('builds validation results from errors and warnings', () => {
    const error = createDiagnosticError(
      'PROJECT_SETUP001',
      'project.name is required.',
      { path: ['project', 'name'] }
    );
    const warning = createDiagnosticWarning(
      'PROJECT_SETUP100',
      'Unknown field ignored.',
      { path: ['project', 'unexpected'] }
    );

    const result = buildDiagnosticResult([error, warning]);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([error]);
    expect(result.warnings).toEqual([warning]);
  });

  it('preserves structured error details', () => {
    const issue = createDiagnosticError(
      'PROJECT_DATA001',
      'Project database not found.',
      { path: ['project'] },
      'Run renku create first.'
    );

    const error = new StructuredError({
      code: 'PROJECT_DATA001',
      message: 'Project data failed.',
      issues: [issue],
      suggestion: 'Check the project name.',
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('PROJECT_DATA001');
    expect(error.issues).toEqual([issue]);
    expect(error.suggestion).toBe('Check the project name.');
  });
});
