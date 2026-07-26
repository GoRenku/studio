import Ajv2020, { type ErrorObject } from 'ajv/dist/2020.js';
import {
  createDiagnosticError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type {
  ShotBrief,
  ShotInput,
  ShotPlanAuthoringDocument,
  ShotPlanCoverage,
  ShotPlanValidationReport,
} from '../../client/shot-plans.js';
import {
  shotBriefSchema,
  shotDocumentSchema,
  shotPlanCreateDocumentSchema,
  shotPlanCoverageSchema,
  shotPlanUpdateDocumentSchema,
} from '../../client/shot-plan-json-schemas.js';
import { ProjectDataError } from '../project-data-error.js';

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
  removeAdditional: false,
  useDefaults: false,
  coerceTypes: false,
});

const validateCoverage = ajv.compile(shotPlanCoverageSchema);
const validateBrief = ajv.compile(shotBriefSchema);
const validateCreateDocument = ajv.compile(shotPlanCreateDocumentSchema);
const validateUpdateDocument = ajv.compile(shotPlanUpdateDocumentSchema);
const validateShotDocument = ajv.compile(shotDocumentSchema);

export function validateShotPlanDocument(
  document: unknown
): ShotPlanValidationReport {
  const kind =
    typeof document === 'object' &&
    document !== null &&
    'kind' in document &&
    typeof document.kind === 'string'
      ? document.kind
      : null;
  const validator =
    kind === 'shotPlanCreate'
      ? validateCreateDocument
      : kind === 'shotPlanUpdate'
        ? validateUpdateDocument
        : kind === 'shot'
          ? validateShotDocument
          : null;
  if (!validator) {
    throw new ProjectDataError(
      'CORE_SHOT_PLAN_INVALID',
      'Shot Plan authoring document kind is invalid.',
      {
        issues: [
          error(
            'Document kind must be shotPlanCreate, shotPlanUpdate, or shot.',
            ['kind']
          ),
        ],
      }
    );
  }
  if (!validator(document)) {
    throw new ProjectDataError(
      'CORE_SHOT_PLAN_INVALID',
      'Shot Plan authoring document failed validation.',
      {
        issues: ajvIssues(validator.errors ?? [], []),
        suggestion:
          'Use the documented current Shot Plan authoring document contract.',
      }
    );
  }
  return {
    valid: true,
    document: document as ShotPlanAuthoringDocument,
    warnings: [],
  };
}

export function validateShotPlanDetails(input: {
  title: string;
  coverage: ShotPlanCoverage | null;
}): {
  title: string;
  coverage: ShotPlanCoverage | null;
} {
  const issues: DiagnosticIssue[] = [];
  const title = requireTrimmedText(input.title, ['title'], issues);
  if (input.coverage !== null && !validateCoverage(input.coverage)) {
    issues.push(...ajvIssues(validateCoverage.errors ?? [], ['coverage']));
  }
  throwIfIssues(issues);
  return {
    title,
    coverage: input.coverage,
  };
}

export function validateShotInput(
  shot: ShotInput,
  path: string[] = ['shot']
): ShotInput {
  const issues: DiagnosticIssue[] = [];
  const title = requireTrimmedText(shot.title, [...path, 'title'], issues);
  if (typeof shot.description !== 'string') {
    issues.push(
      error('Shot description must be text.', [...path, 'description'])
    );
  }
  if (!validateBrief(shot.brief)) {
    issues.push(...ajvIssues(validateBrief.errors ?? [], [...path, 'brief']));
  }
  throwIfIssues(issues);
  return {
    title,
    description: shot.description,
    brief: shot.brief,
  };
}

export function parseStoredShotPlanCoverage(
  value: string | null,
  shotPlanId: string
): ShotPlanCoverage | null {
  if (value === null) {
    return null;
  }
  return parseStoredJson({
    value,
    validate: validateCoverage,
    label: 'Shot Plan coverage',
    path: ['shotPlan', shotPlanId, 'coverage'],
  }) as ShotPlanCoverage;
}

export function parseStoredShotBrief(value: string, shotId: string): ShotBrief {
  return parseStoredJson({
    value,
    validate: validateBrief,
    label: 'Shot brief',
    path: ['shot', shotId, 'brief'],
  }) as ShotBrief;
}

export function serializeShotPlanCoverage(
  coverage: ShotPlanCoverage | null
): string | null {
  if (coverage === null) {
    return null;
  }
  if (!validateCoverage(coverage)) {
    throwInvalidStoredShape('Shot Plan coverage', validateCoverage.errors ?? []);
  }
  return JSON.stringify(coverage);
}

export function serializeShotBrief(brief: ShotBrief): string {
  if (!validateBrief(brief)) {
    throwInvalidStoredShape('Shot brief', validateBrief.errors ?? []);
  }
  return JSON.stringify(brief);
}

function parseStoredJson(input: {
  value: string;
  validate: typeof validateBrief;
  label: string;
  path: string[];
}): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.value);
  } catch {
    throw new ProjectDataError(
      'CORE_SHOT_PLAN_STORAGE_INVALID',
      `Stored ${input.label} must be valid JSON.`,
      {
        issues: [
          error(
            `Stored ${input.label} must be valid JSON.`,
            input.path,
            `Repair the stored ${input.label} JSON.`
          ),
        ],
      }
    );
  }
  if (!input.validate(parsed)) {
    throw new ProjectDataError(
      'CORE_SHOT_PLAN_STORAGE_INVALID',
      `Stored ${input.label} failed validation.`,
      {
        issues: ajvIssues(input.validate.errors ?? [], input.path),
        suggestion: `Repair the stored ${input.label} JSON.`,
      }
    );
  }
  return parsed;
}

function requireTrimmedText(
  value: unknown,
  path: string[],
  issues: DiagnosticIssue[]
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    issues.push(error('Value must be non-empty text.', path));
    return '';
  }
  return value.trim();
}

function ajvIssues(errors: ErrorObject[], basePath: string[]): DiagnosticIssue[] {
  return errors.map((validationError) => {
    const path = [
      ...basePath,
      ...validationError.instancePath
        .split('/')
        .slice(1)
        .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~')),
    ];
    return error(
      validationError.keyword === 'additionalProperties'
        ? `Unknown field is not allowed: ${String(
            validationError.params.additionalProperty
          )}.`
        : `Invalid value at ${path.join('.') || '<root>'}.`,
      path,
      'Use the documented Shot Plan coverage and Shot brief contract.'
    );
  });
}

function error(
  message: string,
  path: string[],
  suggestion?: string
): DiagnosticIssue {
  return createDiagnosticError(
    'CORE_SHOT_PLAN_INVALID',
    message,
    { path },
    suggestion
  );
}

function throwIfIssues(issues: DiagnosticIssue[]): void {
  if (issues.length === 0) {
    return;
  }
  throw new ProjectDataError(
    'CORE_SHOT_PLAN_INVALID',
    'Shot Plan input failed validation.',
    {
      issues,
      suggestion: 'Fix the reported Shot Plan fields and try again.',
    }
  );
}

function throwInvalidStoredShape(
  label: string,
  errors: ErrorObject[]
): never {
  throw new ProjectDataError(
    'CORE_SHOT_PLAN_INVALID',
    `${label} failed validation.`,
    {
      issues: ajvIssues(errors, []),
    }
  );
}
