import Ajv2020, { type ErrorObject } from 'ajv/dist/2020.js';
import {
  buildDiagnosticResult,
  createDiagnosticError,
  createDiagnosticWarning,
  throwIfDiagnosticResultInvalid,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import {
  screenplayBlockArraySchema,
  screenplayBlockSchema,
  screenplayCreateDocumentSchema,
  screenplayDocumentSchema,
  screenplayOperationsSchema,
  screenplayReferenceSchema,
  screenplaySceneRevisionDocumentSchema,
  screenplayStringArraySchema,
} from '../../client/screenplay-json-schemas.js';

const SCREENPLAY_DOCUMENT_SCHEMA_ID =
  'https://schemas.gorenku.com/studio/screenplay-document.schema.json';
const SCREENPLAY_OPERATIONS_SCHEMA_ID =
  'https://schemas.gorenku.com/studio/screenplay-operations.schema.json';
const SCREENPLAY_CREATE_DOCUMENT_SCHEMA_ID =
  'https://schemas.gorenku.com/studio/screenplay-create-document.schema.json';
const SCREENPLAY_SCENE_REVISION_SCHEMA_ID =
  'https://schemas.gorenku.com/studio/screenplay-scene-revision.schema.json';
const SCREENPLAY_BLOCK_ARRAY_SCHEMA_ID =
  'https://schemas.gorenku.com/studio/screenplay-block-array.schema.json';
const SCREENPLAY_STRING_ARRAY_SCHEMA_ID =
  'https://schemas.gorenku.com/studio/screenplay-string-array.schema.json';

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
  removeAdditional: false,
  useDefaults: false,
  coerceTypes: false,
});

ajv.addSchema(screenplayReferenceSchema);
ajv.addSchema(screenplayBlockSchema);
ajv.addSchema(screenplayBlockArraySchema);
ajv.addSchema(screenplayStringArraySchema);
ajv.addSchema(screenplayDocumentSchema);
ajv.addSchema(screenplayCreateDocumentSchema);
ajv.addSchema(screenplayOperationsSchema);
ajv.addSchema(screenplaySceneRevisionDocumentSchema);

export type ScreenplayJsonKind =
  | 'screenplay'
  | 'screenplayCreate'
  | 'screenplayOperations'
  | 'screenplaySceneRevision';

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
    kind === 'screenplay'
      ? SCREENPLAY_DOCUMENT_SCHEMA_ID
      : kind === 'screenplayCreate'
        ? SCREENPLAY_CREATE_DOCUMENT_SCHEMA_ID
        : kind === 'screenplaySceneRevision'
          ? SCREENPLAY_SCENE_REVISION_SCHEMA_ID
          : SCREENPLAY_OPERATIONS_SCHEMA_ID
  );
  if (!validator) {
    throw new Error(`Screenplay JSON schema was not registered for ${kind}.`);
  }
  const valid = validator(input.value);
  const issues = [
    ...mapAjvErrors(validator.errors ?? [], input.filePath),
    ...collectUnknownFieldWarnings(input.value, kind, input.filePath),
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

export type ScreenplayStoredJsonFragmentKind = 'blockArray' | 'stringArray';

export function validateScreenplayStoredJsonFragment(input: {
  value: unknown;
  fragment: ScreenplayStoredJsonFragmentKind;
  path: string[];
  filePath?: string;
}): void {
  const schemaId =
    input.fragment === 'blockArray'
      ? SCREENPLAY_BLOCK_ARRAY_SCHEMA_ID
      : SCREENPLAY_STRING_ARRAY_SCHEMA_ID;
  const validator = ajv.getSchema(schemaId);
  if (!validator) {
    throw new Error(`Screenplay stored JSON schema was not registered for ${input.fragment}.`);
  }
  const valid = validator(input.value);
  if (valid) {
    return;
  }
  throwIfDiagnosticResultInvalid(
    buildDiagnosticResult(mapAjvErrors(validator.errors ?? [], input.filePath, input.path)),
    {
      code: 'PROJECT_DATA200',
      message: 'Stored screenplay JSON failed validation.',
      suggestion: 'Repair the stored screenplay data before reading it.',
    }
  );
}

function inferKind(value: unknown): ScreenplayJsonKind {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return 'screenplay';
  }
  const kind = (value as { kind?: unknown }).kind;
  return kind === 'screenplayOperations'
    ? 'screenplayOperations'
    : kind === 'screenplaySceneRevision'
      ? 'screenplaySceneRevision'
    : kind === 'screenplayCreate'
      ? 'screenplayCreate'
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

function mapAjvErrors(
  errors: ErrorObject[],
  filePath?: string,
  pathPrefix: string[] = []
): DiagnosticIssue[] {
  return errors
    .filter((error) => error.keyword !== 'not')
    .map((error) => {
      const path = [...pathPrefix, ...pointerToPath(error.instancePath)];
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
  screenplayDocumentRoot: new Set(['kind', 'screenplay', 'cast', 'locations', 'acts']),
  screenplayOperationsRoot: new Set(['kind', 'operations']),
  screenplaySceneRevisionRoot: new Set(['kind', 'scene']),
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
    'status',
    'researchSources',
    'assumptionsMade',
  ]),
  castMember: new Set(['id', 'key', 'handle', 'name', 'role', 'age', 'want', 'need', 'arc', 'voiceNotes', 'description']),
  location: new Set(['id', 'key', 'handle', 'name', 'timePeriod', 'description', 'visualNotes']),
  act: new Set(['id', 'key', 'title', 'purpose', 'sequences']),
  sequence: new Set(['id', 'key', 'title', 'purpose', 'scenes']),
  scene: new Set(['id', 'key', 'title', 'setting', 'storyFunction', 'blocks']),
  setting: new Set(['interiorExterior', 'timeOfDay', 'locationReferences', 'locationIds']),
  block: new Set(['type', 'text', 'render', 'dialogueId', 'dialogueOrderKey', 'castMemberReference', 'castMemberId', 'extension', 'parenthetical', 'lines', 'castMemberReferences', 'locationReferences', 'castMemberIds', 'locationIds']),
  ref: new Set(['id', 'key']),
  operation: new Set(['operation', 'screenplay', 'act', 'actId', 'sequence', 'sequenceId', 'fromActId', 'toActId', 'scene', 'sceneId', 'fromSequenceId', 'toSequenceId', 'placement']),
  placement: new Set(['beforeId', 'afterId', 'position']),
};

type ScreenplayJsonShape = keyof typeof allowedFields;

function collectUnknownFieldWarnings(
  value: unknown,
  kind: ScreenplayJsonKind,
  filePath?: string
): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  visitObject(value, [], rootShapeForKind(kind), issues, filePath);
  return issues;
}

function rootShapeForKind(kind: ScreenplayJsonKind): ScreenplayJsonShape {
  return kind === 'screenplayOperations'
    ? 'screenplayOperationsRoot'
    : kind === 'screenplaySceneRevision'
      ? 'screenplaySceneRevisionRoot'
      : 'screenplayDocumentRoot';
}

function visitObject(
  value: unknown,
  path: string[],
  shape: ScreenplayJsonShape,
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
  if (shape === 'screenplayDocumentRoot') {
    visitObject(record.screenplay, [...path, 'screenplay'], 'screenplay', issues, filePath);
    visitArray(record.cast, [...path, 'cast'], 'castMember', issues, filePath);
    visitArray(record.locations, [...path, 'locations'], 'location', issues, filePath);
    visitArray(record.acts, [...path, 'acts'], 'act', issues, filePath);
  }
  if (shape === 'screenplayOperationsRoot') {
    visitArray(record.operations, [...path, 'operations'], 'operation', issues, filePath);
  }
  if (shape === 'screenplaySceneRevisionRoot') {
    visitObject(record.scene, [...path, 'scene'], 'scene', issues, filePath);
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
    visitArray(record.locationReferences, [...path, 'locationReferences'], 'ref', issues, filePath);
  }
  if (shape === 'block') {
    visitObject(record.castMemberReference, [...path, 'castMemberReference'], 'ref', issues, filePath);
    visitArray(record.castMemberReferences, [...path, 'castMemberReferences'], 'ref', issues, filePath);
    visitArray(record.locationReferences, [...path, 'locationReferences'], 'ref', issues, filePath);
  }
  if (shape === 'operation') {
    visitObject(record.screenplay, [...path, 'screenplay'], 'screenplay', issues, filePath);
    visitObject(record.act, [...path, 'act'], 'act', issues, filePath);
    visitObject(record.sequence, [...path, 'sequence'], 'sequence', issues, filePath);
    visitObject(record.scene, [...path, 'scene'], 'scene', issues, filePath);
    visitObject(record.placement, [...path, 'placement'], 'placement', issues, filePath);
  }
}

function visitArray(
  value: unknown,
  path: string[],
  shape: ScreenplayJsonShape,
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
