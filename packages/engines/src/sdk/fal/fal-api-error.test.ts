import { ApiError, ValidationError } from '@fal-ai/client';
import { describe, expect, it } from 'vitest';
import { SdkErrorCode } from '../errors.js';
import { normalizeFalApiError } from './fal-api-error.js';

describe('normalizeFalApiError', () => {
  it('preserves fal validation details and the queued request id for a 422 rejection', () => {
    const raw = new ValidationError({
      message: 'Unprocessable Entity',
      status: 422,
      body: {
        detail: [{
          loc: ['body', 'image_url'],
          msg: 'The images or videos provided may contain likenesses of real people or other private information that cannot be processed.',
          type: 'value_error',
        }],
      },
    }) as ValidationError & { falRequestId?: string };
    raw.falRequestId = '019fb40e-7b7d-7f81-bf7d-43ba46516949';

    const error = normalizeFalApiError(raw, {
      model: 'fal-ai/seedance-2/image-to-video',
    });

    expect(error).toMatchObject({
      code: SdkErrorCode.PROVIDER_PREDICTION_FAILED,
      kind: 'user_input',
      retryable: false,
      causedByUser: true,
      provider: 'fal-ai',
      model: 'fal-ai/seedance-2/image-to-video',
      providerRequestId: '019fb40e-7b7d-7f81-bf7d-43ba46516949',
      metadata: {
        provider: 'fal-ai',
        model: 'fal-ai/seedance-2/image-to-video',
        httpStatus: 422,
        providerRequestId: '019fb40e-7b7d-7f81-bf7d-43ba46516949',
        validationIssues: [{
          path: ['body', 'image_url'],
          message: 'The images or videos provided may contain likenesses of real people or other private information that cannot be processed.',
          type: 'value_error',
        }],
      },
    });
    expect(error?.message).toBe(
      'fal.ai rejected the request (422): image_url: The images or videos provided may contain likenesses of real people or other private information that cannot be processed. (request ID: 019fb40e-7b7d-7f81-bf7d-43ba46516949)',
    );
  });

  it('preserves custom string validation details', () => {
    const raw = new ValidationError({
      message: 'Unprocessable Entity',
      status: 422,
      body: {
        detail: 'The selected reference cannot be processed.',
      },
      requestId: 'request-custom-detail',
    });

    const error = normalizeFalApiError(raw, {
      model: 'fal-ai/example',
    });

    expect(error?.message).toBe(
      'fal.ai rejected the request (422): The selected reference cannot be processed. (request ID: request-custom-detail)',
    );
  });

  it('classifies retryable fal service failures as transient', () => {
    const raw = new ApiError({
      message: 'Service Unavailable',
      status: 503,
      body: {},
      requestId: 'request-service-unavailable',
    });

    const error = normalizeFalApiError(raw, {
      model: 'fal-ai/example',
    });

    expect(error).toMatchObject({
      code: SdkErrorCode.PROVIDER_PREDICTION_FAILED,
      kind: 'transient',
      retryable: true,
      causedByUser: false,
    });
    expect(error?.message).toBe(
      'fal.ai request failed (503): Service Unavailable (request ID: request-service-unavailable)',
    );
  });

  it('does not claim unrelated errors as fal API failures', () => {
    expect(
      normalizeFalApiError(new Error('fetch failed'), {
        model: 'fal-ai/example',
      }),
    ).toBeUndefined();
  });
});
