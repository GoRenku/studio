import { studioCoordinationError } from './studio-coordination-errors.js';

export function parseStudioEventCursor(cursor: string | undefined): number {
  if (cursor === undefined || cursor === '') {
    return 0;
  }
  if (!/^(0|[1-9]\d*)$/.test(cursor)) {
    throw studioCoordinationError(
      'STUDIO_COORDINATION002',
      'Studio event cursor must be a non-negative decimal byte offset.',
      ['after'],
      'Use the nextCursor value returned by the Studio events API.'
    );
  }
  const offset = Number(cursor);
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw studioCoordinationError(
      'STUDIO_COORDINATION002',
      'Studio event cursor is outside the supported byte offset range.',
      ['after'],
      'Use the nextCursor value returned by the Studio events API.'
    );
  }
  return offset;
}

export function formatStudioEventCursor(offset: number): string {
  return String(offset);
}
