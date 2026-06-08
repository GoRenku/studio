import Ajv2020, { type ErrorObject } from 'ajv/dist/2020.js';
import {
  buildDiagnosticResult,
  createDiagnosticError,
  throwIfDiagnosticResultInvalid,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type {
  CastDesignDocument,
  CastOperationDocument,
  LocationDesignDocument,
  LocationOperationDocument,
} from '../../client/department-design.js';
import {
  castDesignSchema,
  castOperationsSchema,
  departmentPlacementSchema,
  locationDesignSchema,
  locationOperationsSchema,
} from '../../client/department-design-json-schemas.js';

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
  removeAdditional: false,
  useDefaults: false,
  coerceTypes: false,
});

ajv.addSchema(departmentPlacementSchema);
ajv.addSchema(castOperationsSchema);
ajv.addSchema(locationOperationsSchema);
ajv.addSchema(castDesignSchema);
ajv.addSchema(locationDesignSchema);

type DepartmentDocumentKind =
  | 'castOperations'
  | 'locationOperations'
  | 'castDesign'
  | 'locationDesign';

const schemaIds: Record<DepartmentDocumentKind, string> = {
  castOperations: 'https://schemas.gorenku.com/studio/cast-operations.schema.json',
  locationOperations: 'https://schemas.gorenku.com/studio/location-operations.schema.json',
  castDesign: 'https://schemas.gorenku.com/studio/cast-design.schema.json',
  locationDesign: 'https://schemas.gorenku.com/studio/location-design.schema.json',
};

export function parseDepartmentJson(input: {
  contents: string;
  filePath?: string;
}): unknown {
  try {
    const parsed = JSON.parse(input.contents);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throwInvalidJson(input.filePath);
    }
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throwInvalidJson(input.filePath);
    }
    throw error;
  }
}

export function assertCastOperationDocument(input: {
  document: CastOperationDocument;
  filePath?: string;
}): DiagnosticIssue[] {
  assertDepartmentDocument({
    value: input.document,
    kind: 'castOperations',
    filePath: input.filePath,
  });
  return [];
}

export function assertLocationOperationDocument(input: {
  document: LocationOperationDocument;
  filePath?: string;
}): DiagnosticIssue[] {
  assertDepartmentDocument({
    value: input.document,
    kind: 'locationOperations',
    filePath: input.filePath,
  });
  return [];
}

export function assertCastDesignDocument(input: {
  document: CastDesignDocument;
  filePath?: string;
}): DiagnosticIssue[] {
  assertDepartmentDocument({
    value: input.document,
    kind: 'castDesign',
    filePath: input.filePath,
  });
  return [];
}

export function assertLocationDesignDocument(input: {
  document: LocationDesignDocument;
  filePath?: string;
}): DiagnosticIssue[] {
  assertDepartmentDocument({
    value: input.document,
    kind: 'locationDesign',
    filePath: input.filePath,
  });
  return [];
}

function assertDepartmentDocument(input: {
  value: unknown;
  kind: DepartmentDocumentKind;
  filePath?: string;
}): void {
  const validator = ajv.getSchema(schemaIds[input.kind]);
  if (!validator) {
    throw new Error(`Department JSON schema was not registered for ${input.kind}.`);
  }
  if (validator(input.value)) {
    return;
  }
  throwIfDiagnosticResultInvalid(
    buildDiagnosticResult(mapAjvErrors(validator.errors ?? [], input.filePath)),
    {
      code: 'PROJECT_DATA200',
      message: 'Department JSON failed validation.',
      suggestion: 'Fix the reported department document issues and run the command again.',
    }
  );
}

function throwInvalidJson(filePath?: string): never {
  throwIfDiagnosticResultInvalid(
    buildDiagnosticResult([
      createDiagnosticError(
        'PROJECT_DATA201',
        'Input must be a valid JSON object.',
        { path: [], ...(filePath ? { filePath } : {}) },
        'Provide a valid JSON object.'
      ),
    ]),
    {
      code: 'PROJECT_DATA201',
      message: 'Input must be a valid JSON object.',
      suggestion: 'Provide a valid JSON object.',
    }
  );
  throw new Error('unreachable');
}

function mapAjvErrors(
  errors: ErrorObject[],
  filePath?: string
): DiagnosticIssue[] {
  return errors
    .filter((error) => error.keyword !== 'not')
    .map((error) => {
      const path = pointerToPath(error.instancePath);
      if (error.keyword === 'required') {
        const missing = String(error.params.missingProperty);
        return createDiagnosticError(
          'PROJECT_DATA206',
          `${missing} is required.`,
          { path: [...path, missing], ...(filePath ? { filePath } : {}) },
          `Add the required ${missing} field.`
        );
      }
      if (error.keyword === 'const' || error.keyword === 'enum') {
        return createDiagnosticError(
          'PROJECT_DATA207',
          `Unsupported value at ${formatPath(path)}.`,
          { path, ...(filePath ? { filePath } : {}) },
          'Use one of the documented values.'
        );
      }
      if (error.keyword === 'additionalProperties') {
        const field = String(error.params.additionalProperty);
        return createDiagnosticError(
          'PROJECT_DATA214',
          `Unknown field is not allowed: ${field}.`,
          { path: [...path, field], ...(filePath ? { filePath } : {}) },
          'Remove the field or add it to the accepted department contract first.'
        );
      }
      if (error.keyword === 'oneOf' || error.keyword === 'anyOf') {
        return createDiagnosticError(
          'PROJECT_DATA211',
          `Malformed department document choice at ${formatPath(path)}.`,
          { path, ...(filePath ? { filePath } : {}) },
          'Use one of the documented object shapes.'
        );
      }
      return createDiagnosticError(
        'PROJECT_DATA208',
        `Invalid value at ${formatPath(path)}.`,
        { path, ...(filePath ? { filePath } : {}) },
        'Use the documented type for this field.'
      );
    });
}

function pointerToPath(pointer: string): string[] {
  if (!pointer) {
    return [];
  }
  return pointer
    .slice(1)
    .split('/')
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function formatPath(path: string[]): string {
  return path.length ? path.join('.') : 'input';
}
