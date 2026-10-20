import Ajv2020, { type ErrorObject } from 'ajv/dist/2020.js';
import { createDiagnosticError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import {
  castMemberDescriptionSchema,
  locationDescriptionSchema,
  propDescriptionSchema,
} from '../../client/profile-descriptions/schemas.js';
import type {
  CastMemberDescription,
  LocationDescription,
  PropDescription,
} from '../../client/profile-descriptions/model.js';
import { ProjectDataError } from '../project-data-error.js';

const STORED_INVALID = 'PROFILE_DESCRIPTION_STORED_INVALID';

type ProfileDescriptionSubject = 'castMember' | 'location' | 'prop';

const schemaIds: Record<ProfileDescriptionSubject, string> = {
  castMember: castMemberDescriptionSchema.$id,
  location: locationDescriptionSchema.$id,
  prop: propDescriptionSchema.$id,
};

let cachedAjv: Ajv2020 | undefined;

function getAjv(): Ajv2020 {
  if (cachedAjv) {
    return cachedAjv;
  }
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    strictRequired: false,
    removeAdditional: false,
    useDefaults: false,
    coerceTypes: false,
  });
  ajv.addSchema(castMemberDescriptionSchema);
  ajv.addSchema(locationDescriptionSchema);
  ajv.addSchema(propDescriptionSchema);
  cachedAjv = ajv;
  return ajv;
}

/**
 * Serializes a description that already passed operation-document validation.
 * An absent description is stored as SQL NULL.
 */
export function serializeProfileDescription(
  description: CastMemberDescription | LocationDescription | PropDescription | undefined
): string | null {
  return description ? JSON.stringify(description) : null;
}

export function parseStoredCastMemberDescription(
  value: string | null,
  castMemberId: string
): CastMemberDescription | undefined {
  return parseStored('castMember', value, castMemberId) as CastMemberDescription | undefined;
}

export function parseStoredLocationDescription(
  value: string | null,
  locationId: string
): LocationDescription | undefined {
  return parseStored('location', value, locationId) as LocationDescription | undefined;
}

export function parseStoredPropDescription(
  value: string | null,
  propId: string
): PropDescription | undefined {
  return parseStored('prop', value, propId) as PropDescription | undefined;
}

function parseStored(
  subject: ProfileDescriptionSubject,
  value: string | null,
  ownerId: string
): unknown {
  if (value === null) {
    return undefined;
  }
  const path = [subject, ownerId, 'description'];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throwStoredInvalid(subject, ownerId, [
      createDiagnosticError(STORED_INVALID, 'Stored description must be valid JSON.', { path }),
    ]);
  }
  const validator = getAjv().getSchema(schemaIds[subject]);
  if (!validator) {
    throwStoredInvalid(subject, ownerId, [
      createDiagnosticError(STORED_INVALID, 'Description schema is unavailable.', { path }),
    ]);
  }
  if (!validator(parsed)) {
    throwStoredInvalid(subject, ownerId, mapAjvErrors(validator.errors ?? [], path));
  }
  return parsed;
}

function mapAjvErrors(errors: ErrorObject[], basePath: string[]): DiagnosticIssue[] {
  return errors.map((error) => {
    const path = [
      ...basePath,
      ...error.instancePath.split('/').slice(1),
      ...(error.keyword === 'additionalProperties' ? [String(error.params.additionalProperty)] : []),
    ];
    return createDiagnosticError(
      STORED_INVALID,
      `Invalid stored description value at ${path.join('.')}.`,
      { path }
    );
  });
}

function throwStoredInvalid(
  subject: ProfileDescriptionSubject,
  ownerId: string,
  issues: DiagnosticIssue[]
): never {
  throw new ProjectDataError(
    STORED_INVALID,
    `Stored ${subject} description for ${ownerId} does not match the description sections contract.`,
    {
      issues,
      suggestion: 'Run `renku project migrate`, or rewrite the description with the current sections.',
    }
  );
}
