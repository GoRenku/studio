import Ajv2020, { type ErrorObject } from 'ajv/dist/2020.js';
import {
  buildDiagnosticResult,
  createDiagnosticError,
  createDiagnosticWarning,
  throwIfDiagnosticResultInvalid,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import {
  screenplayBlockSchema,
  screenplayDocumentSchema,
  screenplayOperationsSchema,
  screenplayReferenceSchema,
} from '../../client/screenplay-json-schemas.js';

const SCREENPLAY_DOCUMENT_SCHEMA_ID =
  'https://schemas.gorenku.com/studio/screenplay-document.schema.json';
const SCREENPLAY_OPERATIONS_SCHEMA_ID =
  'https://schemas.gorenku.com/studio/screenplay-operations.schema.json';

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  removeAdditional: false,
  useDefaults: false,
  coerceTypes: false,
});

ajv.addSchema(screenplayReferenceSchema);
ajv.addSchema(screenplayBlockSchema);
ajv.addSchema(screenplayDocumentSchema);
ajv.addSchema(screenplayOperationsSchema);

export type ScreenplayJsonKind = 'screenplay' | 'screenplayOperations';

export function parseScreenplayJson(input: {
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

export function validateScreenplayJsonDocument(input: {
  value: unknown;
  kind?: ScreenplayJsonKind;
  filePath?: string;
}): DiagnosticIssue[] {
  const kind = input.kind ?? inferKind(input.value);
  const validator = ajv.getSchema(
    kind === 'screenplay' ? SCREENPLAY_DOCUMENT_SCHEMA_ID : SCREENPLAY_OPERATIONS_SCHEMA_ID
  );
  if (!validator) {
    throw new Error(`Screenplay JSON schema was not registered for ${kind}.`);
  }
  const valid = validator(input.value);
  const issues = [
    ...mapAjvErrors(validator.errors ?? [], input.filePath),
    ...collectUnknownFieldWarnings(input.value, input.filePath),
  ];
  if (!valid) {
    throwIfDiagnosticResultInvalid(buildDiagnosticResult(issues), {
      code: 'PROJECT_DATA200',
      message: 'Screenplay JSON failed validation.',
      suggestion: 'Fix the reported screenplay issues and run the command again.',
    });
  }
  return issues;
}

function inferKind(value: unknown): ScreenplayJsonKind {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return 'screenplay';
  }
  return (value as { kind?: unknown }).kind === 'screenplayOperations'
    ? 'screenplayOperations'
    : 'screenplay';
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

function mapAjvErrors(errors: ErrorObject[], filePath?: string): DiagnosticIssue[] {
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
      if (error.keyword === 'oneOf') {
        return createDiagnosticError(
          'PROJECT_DATA211',
          `Malformed screenplay choice at ${formatPath(path)}.`,
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

const allowedFields: Record<string, Set<string>> = {
  root: new Set(['kind', 'screenplay', 'cast', 'locations', 'acts', 'operations']),
  screenplay: new Set([
    'title',
    'intendedAudience',
    'targetLengthLabel',
    'estimatedMinutes',
    'genrePrimary',
    'genreSecondary',
    'tone',
    'ratingIntent',
    'boundaries',
    'logline',
    'summary',
    'premiseOverview',
    'centralConflict',
    'dramaticQuestion',
    'themes',
    'historicalBasis',
    'dramatizedElements',
    'structureModel',
    'status',
    'researchSources',
    'assumptionsMade',
  ]),
  castMember: new Set(['id', 'localKey', 'name', 'role', 'age', 'want', 'need', 'arc', 'voiceNotes', 'description']),
  location: new Set(['id', 'localKey', 'name', 'timePeriod', 'description', 'visualNotes']),
  act: new Set(['id', 'localKey', 'title', 'purpose', 'keyBeats', 'sequences']),
  sequence: new Set(['id', 'localKey', 'title', 'purpose', 'scenes']),
  scene: new Set(['id', 'localKey', 'title', 'setting', 'storyFunction', 'blocks']),
  setting: new Set(['interiorExterior', 'timeOfDay', 'locationRefs']),
  block: new Set(['id', 'localKey', 'type', 'text', 'castMemberRef', 'extension', 'parenthetical', 'lines', 'castMemberRefs', 'locationRefs']),
  ref: new Set(['id', 'localKey']),
  operation: new Set(['operation', 'castMember', 'castMemberId', 'location', 'locationId', 'act', 'actId', 'sequence', 'sequenceId', 'scene', 'sceneId', 'placement']),
  placement: new Set(['beforeId', 'afterId']),
};

function collectUnknownFieldWarnings(value: unknown, filePath?: string): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  visitObject(value, [], 'root', issues, filePath);
  return issues;
}

function visitObject(
  value: unknown,
  path: string[],
  shape: keyof typeof allowedFields,
  issues: DiagnosticIssue[],
  filePath?: string
): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return;
  }
  for (const key of Object.keys(value)) {
    if (!allowedFields[shape].has(key)) {
      issues.push(
        createDiagnosticWarning(
          'PROJECT_DATA214',
          `Unknown field ignored: ${key}.`,
          { path: [...path, key], ...(filePath ? { filePath } : {}) },
          'Remove the field or model it through an existing screenplay field.'
        )
      );
    }
  }
  const record = value as Record<string, unknown>;
  if (shape === 'root') {
    visitObject(record.screenplay, [...path, 'screenplay'], 'screenplay', issues, filePath);
    visitArray(record.cast, [...path, 'cast'], 'castMember', issues, filePath);
    visitArray(record.locations, [...path, 'locations'], 'location', issues, filePath);
    visitArray(record.acts, [...path, 'acts'], 'act', issues, filePath);
    visitArray(record.operations, [...path, 'operations'], 'operation', issues, filePath);
  }
  if (shape === 'act') {
    visitArray(record.sequences, [...path, 'sequences'], 'sequence', issues, filePath);
  }
  if (shape === 'sequence') {
    visitArray(record.scenes, [...path, 'scenes'], 'scene', issues, filePath);
  }
  if (shape === 'scene') {
    visitObject(record.setting, [...path, 'setting'], 'setting', issues, filePath);
    visitArray(record.blocks, [...path, 'blocks'], 'block', issues, filePath);
  }
  if (shape === 'setting') {
    visitArray(record.locationRefs, [...path, 'locationRefs'], 'ref', issues, filePath);
  }
  if (shape === 'block') {
    visitObject(record.castMemberRef, [...path, 'castMemberRef'], 'ref', issues, filePath);
    visitArray(record.castMemberRefs, [...path, 'castMemberRefs'], 'ref', issues, filePath);
    visitArray(record.locationRefs, [...path, 'locationRefs'], 'ref', issues, filePath);
  }
  if (shape === 'operation') {
    visitObject(record.castMember, [...path, 'castMember'], 'castMember', issues, filePath);
    visitObject(record.location, [...path, 'location'], 'location', issues, filePath);
    visitObject(record.act, [...path, 'act'], 'act', issues, filePath);
    visitObject(record.sequence, [...path, 'sequence'], 'sequence', issues, filePath);
    visitObject(record.scene, [...path, 'scene'], 'scene', issues, filePath);
    visitObject(record.placement, [...path, 'placement'], 'placement', issues, filePath);
  }
}

function visitArray(
  value: unknown,
  path: string[],
  shape: keyof typeof allowedFields,
  issues: DiagnosticIssue[],
  filePath?: string
): void {
  if (!Array.isArray(value)) {
    return;
  }
  value.forEach((item, index) =>
    visitObject(item, [...path, String(index)], shape, issues, filePath)
  );
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
