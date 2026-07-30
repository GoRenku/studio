import { ValidationError } from '@fal-ai/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderJobContext } from '../../types.js';
import { SdkErrorCode } from '../errors.js';

const falSubscribeMock = vi.hoisted(() => vi.fn());

vi.mock('./subscribe.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./subscribe.js')>();
  return {
    ...actual,
    falSubscribe: falSubscribeMock,
  };
});

import { falAdapter } from './adapter.js';

describe('falAdapter API failures', () => {
  beforeEach(() => {
    falSubscribeMock.mockReset();
  });

  it('returns fal validation details through the structured provider error contract', async () => {
    falSubscribeMock.mockRejectedValue(
      new ValidationError({
        message: 'Unprocessable Entity',
        status: 422,
        body: {
          detail: [{
            loc: ['body', 'image_url'],
            msg: 'The reference image was rejected by the provider.',
            type: 'value_error',
          }],
        },
        requestId: 'request-validation-failure',
      }),
    );

    const error = await falAdapter.invoke(
      {},
      'fal-ai/seedance-2/image-to-video',
      {},
      {
        mode: 'live',
        request: providerRequest(),
      },
    ).catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code: SdkErrorCode.PROVIDER_PREDICTION_FAILED,
      kind: 'user_input',
      retryable: false,
      providerRequestId: 'request-validation-failure',
      message:
        'fal.ai rejected the request (422): image_url: The reference image was rejected by the provider. (request ID: request-validation-failure)',
    });
  });
});

function providerRequest(): ProviderJobContext {
  return {
    jobId: 'generation-test',
    provider: 'fal-ai',
    model: 'bytedance/seedance-2.0/image-to-video',
    revision: 'media-generation',
    layerIndex: 0,
    attempt: 1,
    inputs: [],
    produces: ['Artifact:GeneratedVideo[output=1]'],
    context: {},
  };
}
