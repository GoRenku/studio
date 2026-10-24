import Ajv2020, { type ErrorObject } from 'ajv/dist/2020.js';
import { createDiagnosticError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import {
  castingRouteSchema,
  castingRoundCreateDocumentSchema,
  castingSettingsSchema,
  castLooksPlanDocumentSchema,
  castWardrobePlanDocumentSchema,
} from '../../client/casting/schemas.js';
import type {
  CastingRoundCreateDocument,
  CastingSettings,
  CastLooksPlanDocument,
  CastWardrobePlanDocument,
} from '../../client/casting/model.js';
import { throwCastingIssues } from './diagnostics.js';

let cachedAjv: Ajv2020 | undefined;

function getAjv(): Ajv2020 {
  if (cachedAjv) {
    return cachedAjv;
  }
  const ajv = new Ajv2020({ allErrors: true, strict: true, removeAdditional: false, useDefaults: false, coerceTypes: false });
  ajv.addSchema(castingRouteSchema);
  ajv.addSchema(castLooksPlanDocumentSchema);
  ajv.addSchema(castWardrobePlanDocumentSchema);
  ajv.addSchema(castingRoundCreateDocumentSchema);
  ajv.addSchema(castingSettingsSchema);
  cachedAjv = ajv;
  return ajv;
}

/** Parses a casting JSON file; the shape is checked by the matching assert. */
export function parseCastingJson(input: { contents: string; filePath?: string }): unknown {
  try {
    return JSON.parse(input.contents);
  } catch {
    return throwCastingIssues([shapeIssue('Input must be a valid JSON object.', [], input.filePath)]);
  }
}

export function assertCastLooksPlanShape(value: unknown, filePath?: string): asserts value is CastLooksPlanDocument {
  assertShape(castLooksPlanDocumentSchema.$id, value, filePath);
}

export function assertCastWardrobePlanShape(value: unknown, filePath?: string): asserts value is CastWardrobePlanDocument {
  assertShape(castWardrobePlanDocumentSchema.$id, value, filePath);
}

export function assertCastingRoundCreateShape(value: unknown, filePath?: string): asserts value is CastingRoundCreateDocument {
  assertShape(castingRoundCreateDocumentSchema.$id, value, filePath);
}

export function assertCastingSettingsShape(value: unknown, filePath?: string): asserts value is CastingSettings {
  assertShape(castingSettingsSchema.$id, value, filePath);
}

function assertShape(schemaId: string, value: unknown, filePath?: string): void {
  const validate = getAjv().getSchema(schemaId);
  if (validate && !validate(value)) {
    throwCastingIssues((validate.errors ?? []).map((error) => ajvIssue(error, filePath)));
  }
}

function ajvIssue(error: ErrorObject, filePath?: string): DiagnosticIssue {
  const path = error.instancePath.split('/').filter(Boolean).map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
  const field = error.keyword === 'required' ? [...path, String(error.params.missingProperty)] : path;
  const message = error.keyword === 'additionalProperties'
    ? `Unknown field: ${String(error.params.additionalProperty)}.`
    : `${field.join('.') || 'document'} ${error.message ?? 'is invalid'}.`;
  return shapeIssue(message, field, filePath);
}

function shapeIssue(message: string, path: string[], filePath?: string): DiagnosticIssue {
  return createDiagnosticError('CASTING_DOCUMENT_INVALID', message, { path, ...(filePath ? { filePath } : {}) });
}
