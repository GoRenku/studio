import {
  buildDiagnosticResult,
  createDiagnosticError,
  throwIfDiagnosticResultInvalid,
} from '@gorenku/studio-diagnostics';
import fs from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import { ProjectDataError } from '../project-data-error.js';
import type {
  ProjectSetup,
  ProjectSetupReadResult,
  ProjectSetupValidation,
} from './contracts.js';
import {
  addProjectSetupError,
  readRecord,
  readRequiredString,
  warnUnknownProjectSetupKeys,
  type ProjectSetupReaderContext,
} from './reader-fields.js';
import { loadReferencedProjectSetupFiles } from './referenced-files.js';
import { readProjectSetupShape } from './shape-reader.js';

export async function readProjectSetupOrThrow(
  setupPath: string
): Promise<ProjectSetupReadResult> {
  let parsed: unknown;
  try {
    parsed = parseYaml(await fs.readFile(setupPath, 'utf8'));
  } catch (error) {
    const message =
      error instanceof Error
        ? `Failed to read project setup YAML: ${error.message}`
        : 'Failed to read project setup YAML.';
    throw new ProjectDataError('PROJECT_SETUP001', message, {
      issues: [
        createDiagnosticError(
          'PROJECT_SETUP001',
          message,
          {
            filePath: setupPath,
            path: [],
            context: 'project setup YAML',
          },
          'Check that the file exists and contains valid YAML.'
        ),
      ],
      suggestion: 'Check that the setup file exists and contains valid YAML.',
    });
  }

  const validation = validateProjectSetup(parsed, setupPath);
  throwIfDiagnosticResultInvalid(validation.result, {
    code: 'PROJECT_SETUP999',
    message: 'Project setup YAML failed validation.',
    suggestion: 'Fix the reported project setup errors and run the command again.',
  });

  if (!validation.setup) {
    throw new ProjectDataError(
      'PROJECT_SETUP999',
      'Project setup YAML failed validation.',
      {
        issues: validation.result.issues,
        suggestion: 'Fix the reported project setup errors and run the command again.',
      }
    );
  }

  const resolved = await loadReferencedProjectSetupFiles(
    validation.setup,
    setupPath,
    validation.result.issues
  );

  return {
    setup: resolved.setup,
    result: validation.result,
    warnings: validation.result.warnings,
    coverPath: resolved.coverPath,
  };
}

export async function readProjectSetup(setupPath: string): Promise<ProjectSetup> {
  return (await readProjectSetupOrThrow(setupPath)).setup;
}

export function validateProjectSetup(
  input: unknown,
  filePath?: string
): ProjectSetupValidation {
  const context: ProjectSetupReaderContext = { filePath, issues: [] };
  const root = readRecord(context, input, [], 'project setup root');
  if (!root) {
    return buildValidation(null, context);
  }

  warnUnknownProjectSetupKeys(context, root, [], [
    'kind',
    'version',
    'project',
    'languages',
    'visualLanguageCategories',
    'visualLanguage',
    'cast',
    'continuityReferences',
    'episodes',
    'sequences',
  ]);

  const kind = readRequiredString(context, root, ['kind'], 'kind is required.');
  if (kind && kind !== 'renku.projectSetup') {
    addProjectSetupError(
      context,
      'PROJECT_SETUP005',
      'kind must be renku.projectSetup.',
      ['kind'],
      'Use kind: renku.projectSetup.'
    );
  }

  const version = readRequiredString(
    context,
    root,
    ['version'],
    'version is required.'
  );
  if (version && version !== '0.1.0') {
    addProjectSetupError(
      context,
      'PROJECT_SETUP005',
      'version must be 0.1.0.',
      ['version'],
      'Use version: 0.1.0.'
    );
  }

  const setup =
    kind === 'renku.projectSetup' && version === '0.1.0'
      ? readProjectSetupShape({ context, root, kind, version })
      : null;
  const result = buildDiagnosticResult(context.issues);
  if (!result.valid || !setup) {
    return { setup: null, result };
  }
  return { setup, result };
}

function buildValidation(
  setup: ProjectSetup | null,
  context: ProjectSetupReaderContext
): ProjectSetupValidation {
  return {
    setup,
    result: buildDiagnosticResult(context.issues),
  };
}
