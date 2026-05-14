import {
  createDiagnosticError,
  createDiagnosticWarning,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';

export interface ProjectSetupReaderContext {
  filePath?: string;
  issues: DiagnosticIssue[];
}

export function readArrayItems<T>(
  context: ProjectSetupReaderContext,
  input: unknown,
  yamlPath: string[],
  reader: (
    context: ProjectSetupReaderContext,
    input: unknown,
    yamlPath: string[]
  ) => T | null
): T[] | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (!Array.isArray(input)) {
    addProjectSetupError(
      context,
      'PROJECT_SETUP004',
      `${formatProjectSetupPath(yamlPath)} must be an array.`,
      yamlPath
    );
    return undefined;
  }
  return input
    .map((item, index) => reader(context, item, [...yamlPath, String(index)]))
    .filter((item): item is T => item !== null);
}

export function readRecord(
  context: ProjectSetupReaderContext,
  input: unknown,
  yamlPath: string[],
  label: string
): Record<string, unknown> | null {
  if (!isRecord(input)) {
    addProjectSetupError(
      context,
      'PROJECT_SETUP004',
      `${label} must be an object.`,
      yamlPath
    );
    return null;
  }
  return input;
}

export function readRequiredString(
  context: ProjectSetupReaderContext,
  record: Record<string, unknown>,
  yamlPath: string[],
  message: string
): string | null {
  const value = record[yamlPath[yamlPath.length - 1]];
  if (value === undefined) {
    addProjectSetupError(context, 'PROJECT_SETUP003', message, yamlPath);
    return null;
  }
  if (typeof value !== 'string' || !value.trim()) {
    addProjectSetupError(
      context,
      'PROJECT_SETUP004',
      `${formatProjectSetupPath(yamlPath)} must be a non-empty string.`,
      yamlPath
    );
    return null;
  }
  return value;
}

export function readOptionalString(
  context: ProjectSetupReaderContext,
  record: Record<string, unknown>,
  yamlPath: string[]
): string | undefined {
  const value = record[yamlPath[yamlPath.length - 1]];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    addProjectSetupError(
      context,
      'PROJECT_SETUP004',
      `${formatProjectSetupPath(yamlPath)} must be a string.`,
      yamlPath
    );
    return undefined;
  }
  return value;
}

export function readOptionalBoolean(
  context: ProjectSetupReaderContext,
  record: Record<string, unknown>,
  yamlPath: string[]
): boolean | undefined {
  const value = record[yamlPath[yamlPath.length - 1]];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'boolean') {
    addProjectSetupError(
      context,
      'PROJECT_SETUP004',
      `${formatProjectSetupPath(yamlPath)} must be a boolean.`,
      yamlPath
    );
    return undefined;
  }
  return value;
}

export function readOptionalNumber(
  context: ProjectSetupReaderContext,
  record: Record<string, unknown>,
  yamlPath: string[]
): number | undefined {
  const value = record[yamlPath[yamlPath.length - 1]];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    addProjectSetupError(
      context,
      'PROJECT_SETUP004',
      `${formatProjectSetupPath(yamlPath)} must be a number.`,
      yamlPath
    );
    return undefined;
  }
  return value;
}

export function warnUnknownProjectSetupKeys(
  context: ProjectSetupReaderContext,
  record: Record<string, unknown>,
  yamlPath: string[],
  allowedKeys: string[]
): void {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(record)) {
    if (allowed.has(key)) {
      continue;
    }
    const issuePath = [...yamlPath, key];
    context.issues.push(
      createDiagnosticWarning(
        'PROJECT_SETUP100',
        `Unknown field ${formatProjectSetupPath(issuePath)} will be ignored.`,
        {
          filePath: context.filePath,
          path: issuePath,
          context: 'project setup YAML',
        },
        'Remove the field or rename it to a supported camelCase setup field.'
      )
    );
  }
}

export function validateProjectSetupTextOrFile(
  context: ProjectSetupReaderContext,
  ownerPath: string[],
  fieldName: 'summary' | 'visualIntent' | 'guidance' | 'prompt' | 'description',
  scalarValue: string | undefined,
  fileValue: string | undefined
): void {
  if (scalarValue !== undefined && fileValue !== undefined) {
    addProjectSetupError(
      context,
      'PROJECT_SETUP008',
      `${formatProjectSetupPath([...ownerPath, fieldName])} cannot be provided as both ${fieldName} and ${fieldName}File.`,
      [...ownerPath, `${fieldName}File`],
      `Remove either ${fieldName} or ${fieldName}File.`
    );
  }
}

export function addProjectSetupError(
  context: ProjectSetupReaderContext,
  code: string,
  message: string,
  yamlPath: string[],
  suggestion?: string
): void {
  context.issues.push(
    createDiagnosticError(
      code,
      message,
      {
        filePath: context.filePath,
        path: yamlPath,
        context: 'project setup YAML',
      },
      suggestion
    )
  );
}

export function formatProjectSetupPath(yamlPath: string[]): string {
  if (yamlPath.length === 0) {
    return '<root>';
  }
  return yamlPath.reduce((label, segment) => {
    if (/^\d+$/.test(segment)) {
      return `${label}[${segment}]`;
    }
    return label ? `${label}.${segment}` : segment;
  }, '');
}

export function isNodeError(error: unknown): error is Error & { code?: unknown } {
  return error instanceof Error && 'code' in error;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}
