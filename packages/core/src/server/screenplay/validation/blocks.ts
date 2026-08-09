import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import {
  createDiagnosticError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import {
  openingElementSchema,
  sceneSchema,
  screenplayBlockSchema,
  screenplayInputSchema,
  screenplayMutationReportSchema,
  screenplayOperationSchema,
  screenplayOperationsInputSchema,
  screenplayReferenceSchema,
  screenplaySchema,
  screenplaySectionSchema,
  screenplayStructureEntrySchema,
  screenplayTextRangeSchema,
  type Screenplay,
  type ScreenplayInput,
  type ScreenplayOperationsInput,
} from '../../../client/screenplay/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { ScreenplaySubjectIds } from './references.js';
import { validateScreenplayReferences } from './references.js';
import { validateScreenplayStructure } from './structure.js';

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
  removeAdditional: false,
  useDefaults: false,
  coerceTypes: false,
});

for (const schema of [
  screenplayTextRangeSchema,
  screenplayBlockSchema,
  openingElementSchema,
  sceneSchema,
  screenplaySectionSchema,
  screenplayStructureEntrySchema,
  screenplayReferenceSchema,
  screenplaySchema,
  screenplayInputSchema,
  screenplayOperationSchema,
  screenplayOperationsInputSchema,
  screenplayMutationReportSchema,
]) {
  ajv.addSchema(schema);
}

const screenplayValidator = requiredValidator(screenplaySchema.$id);
const screenplayInputValidator = requiredValidator(screenplayInputSchema.$id);
const operationsValidator = requiredValidator(screenplayOperationsInputSchema.$id);
const openingValidator = ajv.compile({
  type: 'array',
  items: { $ref: openingElementSchema.$id },
});
const blocksValidator = ajv.compile({
  type: 'array',
  items: { $ref: screenplayBlockSchema.$id },
});

export function parseScreenplayJson(input: {
  contents: string;
  filePath?: string;
}): unknown {
  try {
    const value = JSON.parse(input.contents);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw invalidJson(input.filePath);
    }
    return value;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw invalidJson(input.filePath);
    }
    throw error;
  }
}

export function assertValidScreenplay(
  screenplay: unknown,
  input: { subjects: ScreenplaySubjectIds; context?: string },
): asserts screenplay is Screenplay {
  const issues = schemaIssues(screenplayValidator, screenplay, input.context);
  if (issues.length === 0) {
    const value = screenplay as Screenplay;
    issues.push(...validateScreenplayIdentityScopes(value));
    const structure = validateScreenplayStructure(value);
    issues.push(...structure.issues);
    issues.push(...validateScreenplayReferences({
      opening: value.opening,
      scenes: value.scenes,
      references: value.references,
      subjects: input.subjects,
    }));
  }
  throwIssues(issues, 'Screenplay failed validation.');
}

export function assertValidScreenplaySchema(
  screenplay: unknown,
  context = 'screenplay',
): asserts screenplay is Screenplay {
  throwIssues(
    schemaIssues(screenplayValidator, screenplay, context),
    'Screenplay failed schema validation.',
  );
}

export function assertValidScreenplayInput(
  input: unknown,
  context = 'screenplay input',
): asserts input is ScreenplayInput {
  throwIssues(
    schemaIssues(screenplayInputValidator, input, context),
    'Screenplay input failed validation.',
  );
}

export function assertValidScreenplayOperations(
  input: unknown,
  context = 'screenplay operations',
): asserts input is ScreenplayOperationsInput {
  throwIssues(
    schemaIssues(operationsValidator, input, context),
    'Screenplay operations failed validation.',
  );
}

export function parseStoredOpeningJson(contents: string): Screenplay['opening'] {
  const value = parseStoredJson(contents, ['screenplay', 'opening']);
  throwIssues(
    schemaIssues(openingValidator, value, 'stored screenplay opening'),
    'Stored Screenplay opening failed validation.',
  );
  return value as Screenplay['opening'];
}

export function parseStoredSceneBlocksJson(
  contents: string,
  sceneId: string,
): Screenplay['scenes'][number]['blocks'] {
  const value = parseStoredJson(contents, ['scenes', sceneId, 'blocks']);
  throwIssues(
    schemaIssues(blocksValidator, value, `stored Scene ${sceneId} blocks`),
    'Stored Scene blocks failed validation.',
  );
  return value as Screenplay['scenes'][number]['blocks'];
}

function validateScreenplayIdentityScopes(screenplay: Screenplay): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  const blockIds = new Set<string>();
  const turnIds = new Set<string>();
  const partIds = new Set<string>();

  for (const block of screenplay.opening) {
    addIdentity(blockIds, block.id, ['opening', block.id, 'id'], 'Block', issues);
  }
  for (const scene of screenplay.scenes) {
    for (const block of scene.blocks) {
      addIdentity(blockIds, block.id, ['scenes', scene.id, 'blocks', block.id], 'Block', issues);
      if (block.type === 'dialogue') {
        addIdentity(turnIds, block.id, ['scenes', scene.id, 'blocks', block.id], 'Dialogue Turn', issues);
        for (const part of block.parts) {
          addIdentity(partIds, part.id, ['scenes', scene.id, 'parts', part.id], 'Dialogue Part', issues);
        }
      } else if (block.type === 'dualDialogue') {
        for (const turn of [block.left, block.right]) {
          addIdentity(turnIds, turn.id, ['scenes', scene.id, 'turns', turn.id], 'Dialogue Turn', issues);
          for (const part of turn.parts) {
            addIdentity(partIds, part.id, ['scenes', scene.id, 'parts', part.id], 'Dialogue Part', issues);
          }
        }
      }
    }
  }
  return issues;
}

function addIdentity(
  ids: Set<string>,
  id: string,
  path: string[],
  label: string,
  issues: DiagnosticIssue[],
  code = 'SCREENPLAY_INVALID_CONTENT',
): void {
  if (ids.has(id)) {
    issues.push(createDiagnosticError(
      code,
      `${label} ${id} appears more than once.`,
      { path, context: 'screenplay identity scopes' },
      `Give every ${label} a unique durable ID.`,
    ));
  }
  ids.add(id);
}

function parseStoredJson(contents: string, path: string[]): unknown {
  try {
    return JSON.parse(contents);
  } catch {
    throw new ProjectDataError(
      'SCREENPLAY_INVALID_CONTENT',
      'Stored Screenplay JSON is not valid JSON.',
      {
        issues: [createDiagnosticError(
          'SCREENPLAY_INVALID_CONTENT',
          'Stored Screenplay JSON is not valid JSON.',
          { path, context: 'stored screenplay JSON' },
          'Restore or repair the Project database before reading the Screenplay.',
        )],
      },
    );
  }
}

function schemaIssues(
  validator: ValidateFunction,
  value: unknown,
  context = 'screenplay',
): DiagnosticIssue[] {
  if (validator(value)) {
    return [];
  }
  return (validator.errors ?? [])
    .filter((error) => error.keyword !== 'if')
    .map((error) => mapAjvError(error, context));
}

function mapAjvError(error: ErrorObject, context: string): DiagnosticIssue {
  const path = pointerToPath(error.instancePath);
  if (error.keyword === 'required') {
    path.push(String(error.params.missingProperty));
  }
  return createDiagnosticError(
    'SCREENPLAY_INVALID_CONTENT',
    `Invalid Screenplay value at ${path.length ? path.join('.') : 'root'}: ${error.message ?? error.keyword}.`,
    { path, context },
    'Use the current closed Screenplay contract and remove unsupported fields.',
  );
}

function pointerToPath(pointer: string): string[] {
  return pointer
    .split('/')
    .slice(1)
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function throwIssues(issues: DiagnosticIssue[], message: string): void {
  if (issues.length === 0) {
    return;
  }
  throw new ProjectDataError('SCREENPLAY_INVALID_CONTENT', message, {
    issues,
    suggestion: 'Fix every reported Screenplay issue and retry the command.',
  });
}

function requiredValidator(schemaId: string): ValidateFunction {
  const validator = ajv.getSchema(schemaId);
  if (!validator) {
    throw new Error(`Screenplay schema ${schemaId} was not registered.`);
  }
  return validator;
}

function invalidJson(filePath?: string): ProjectDataError {
  return new ProjectDataError(
    'SCREENPLAY_INVALID_CONTENT',
    'Input must be a valid JSON object.',
    {
      issues: [createDiagnosticError(
        'SCREENPLAY_INVALID_CONTENT',
        'Input must be a valid JSON object.',
        { path: [], context: 'screenplay JSON', ...(filePath ? { filePath } : {}) },
        'Provide a valid JSON object.',
      )],
    },
  );
}
