import { describe, expect, it } from 'vitest';
import {
  StudioApiError,
  isStudioApiErrorCode,
  readStudioApiError,
} from './studio-api-errors';

describe('readStudioApiError', () => {
  it('preserves structured Studio API error codes for callers', async () => {
    const error = await readStudioApiError({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({
        error: {
          code: 'STUDIO_SERVER021',
          message: 'Missing or invalid local Studio API token.',
        },
      }),
    } as Response);

    expect(error).toBeInstanceOf(StudioApiError);
    expect(error.message).toBe(
      'STUDIO_SERVER021: Missing or invalid local Studio API token.'
    );
    expect(isStudioApiErrorCode(error, 'STUDIO_SERVER021')).toBe(true);
    expect(isStudioApiErrorCode(error, 'STUDIO_SERVER020')).toBe(false);
  });
});
