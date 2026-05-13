import { ProjectDataError } from '../../../project/index.js';

export function encodeProjectPageCursor(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function decodeProjectPageCursor(
  cursor: string | null | undefined
): Record<string, unknown> | null {
  if (!cursor) {
    return null;
  }
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw invalidCursor();
    }
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ProjectDataError) {
      throw error;
    }
    throw invalidCursor();
  }
}

export function normalizeProjectPageLimit(
  input: number | undefined,
  defaults: { defaultLimit: number; maxLimit: number }
): number {
  if (input === undefined) {
    return defaults.defaultLimit;
  }
  if (
    !Number.isInteger(input) ||
    input < 1 ||
    input > defaults.maxLimit
  ) {
    throw new ProjectDataError(
      'PROJECT_DATA110',
      `Page limit must be an integer from 1 to ${defaults.maxLimit}.`
    );
  }
  return input;
}

function invalidCursor(): ProjectDataError {
  return new ProjectDataError(
    'PROJECT_DATA109',
    'Page cursor is invalid.',
    {
      suggestion: 'Use the opaque nextCursor returned by the previous page.',
    }
  );
}
