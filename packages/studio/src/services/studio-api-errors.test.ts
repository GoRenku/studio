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
    expect(error.message).toBe('Missing or invalid local Studio API token.');
    expect(isStudioApiErrorCode(error, 'STUDIO_SERVER021')).toBe(true);
    expect(isStudioApiErrorCode(error, 'STUDIO_SERVER020')).toBe(false);
  });

  it('retains structured issues and suggestions and prefers the first actionable issue', async () => {
    const error = await readStudioApiError({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({
        error: {
          code: 'PROJECT_DATA056',
          message: 'Project information failed validation.',
          issues: [
            {
              code: 'PROJECT_DATA050',
              message: 'Project title is required.',
              severity: 'error',
              location: { path: ['title'] },
            },
          ],
          suggestion: 'Enter a project title before saving.',
        },
      }),
    } as Response);

    expect(error).toBeInstanceOf(StudioApiError);
    expect(error).toMatchObject({
      message: 'Project title is required.',
      summary: 'Project information failed validation.',
      suggestion: 'Enter a project title before saving.',
      issues: [expect.objectContaining({ code: 'PROJECT_DATA050' })],
    });
  });
});
