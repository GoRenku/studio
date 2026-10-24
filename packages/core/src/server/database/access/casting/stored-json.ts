import Ajv2020 from 'ajv/dist/2020.js';
import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import {
  castingRouteSchema,
  storedCastingEstimatedCostSchema,
  storedCastingIdListSchema,
  storedCastingRoutesSchema,
  storedCastingTextListSchema,
} from '../../../../client/casting/schemas.js';
import type { CastingEstimatedCost, CastingRoute } from '../../../../client/casting/model.js';
import { ProjectDataError } from '../../../project-data-error.js';

let cachedAjv: Ajv2020 | undefined;

function getAjv(): Ajv2020 {
  if (cachedAjv) {
    return cachedAjv;
  }
  const ajv = new Ajv2020({ allErrors: true, strict: true, removeAdditional: false, useDefaults: false, coerceTypes: false });
  ajv.addSchema(castingRouteSchema);
  ajv.addSchema(storedCastingRoutesSchema);
  ajv.addSchema(storedCastingEstimatedCostSchema);
  ajv.addSchema(storedCastingIdListSchema);
  ajv.addSchema(storedCastingTextListSchema);
  cachedAjv = ajv;
  return ajv;
}

/** Parses a stored casting JSON column against its schema; invalid storage fails fast. */
function parseStored<T>(schemaId: string, value: string, location: string[]): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw storedInvalid(location);
  }
  const validate = getAjv().getSchema(schemaId);
  if (!validate || !validate(parsed)) {
    throw storedInvalid(location);
  }
  return parsed as T;
}

export function parseStoredCastingRoutes(value: string, location: string[]): CastingRoute[] {
  return parseStored(storedCastingRoutesSchema.$id, value, location);
}

export function parseStoredCastingEstimatedCost(value: string | null, location: string[]): CastingEstimatedCost | null {
  return value === null ? null : parseStored(storedCastingEstimatedCostSchema.$id, value, location);
}

export function parseStoredCastingIdList(value: string, location: string[]): string[] {
  return parseStored(storedCastingIdListSchema.$id, value, location);
}

export function parseStoredCastingTextList(value: string, location: string[]): string[] {
  return parseStored(storedCastingTextListSchema.$id, value, location);
}

function storedInvalid(location: string[]): ProjectDataError {
  return new ProjectDataError('CASTING_STORED_INVALID', `Stored casting data is invalid: ${location.join('.')}.`, {
    issues: [createDiagnosticError('CASTING_STORED_INVALID', 'Stored casting JSON does not match its schema.', { path: location })],
    suggestion: 'Rewrite the Looks, wardrobe plan or casting round with the renku cast commands.',
  });
}
