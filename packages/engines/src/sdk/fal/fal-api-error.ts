import {
  ApiError,
  ValidationError,
  isRetryableError,
} from '@fal-ai/client';
import {
  createProviderError,
  SdkErrorCode,
  type ProviderError,
  type ProviderErrorKind,
} from '../errors.js';

const RETRYABLE_FAL_STATUS_CODES = [429, 502, 503, 504];

interface FalValidationIssue {
  path: Array<string | number>;
  message: string;
  type?: string;
}

type FalProviderError = ProviderError & {
  provider: 'fal-ai';
  model: string;
  providerRequestId?: string;
};

export function normalizeFalApiError(
  error: unknown,
  options: { model: string },
): FalProviderError | undefined {
  if (!(error instanceof ApiError)) {
    return undefined;
  }

  const validationIssues = readFalValidationIssues(error);
  const providerRequestId = readFalRequestId(error);
  const retryable = isRetryableError(error, RETRYABLE_FAL_STATUS_CODES);
  const kind = classifyFalApiError(error.status, retryable);
  const providerError = createProviderError(
    error.status === 429
      ? SdkErrorCode.RATE_LIMITED
      : SdkErrorCode.PROVIDER_PREDICTION_FAILED,
    formatFalApiErrorMessage({
      status: error.status,
      fallbackMessage: error.message,
      validationIssues,
      providerRequestId,
    }),
    {
      kind,
      retryable,
      causedByUser: kind === 'user_input',
      metadata: {
        provider: 'fal-ai',
        model: options.model,
        httpStatus: error.status,
        ...(providerRequestId ? { providerRequestId } : {}),
        ...(validationIssues.length > 0 ? { validationIssues } : {}),
      },
      raw: error,
    },
  ) as FalProviderError;

  providerError.provider = 'fal-ai';
  providerError.model = options.model;
  if (providerRequestId) {
    providerError.providerRequestId = providerRequestId;
  }

  return providerError;
}

function readFalValidationIssues(error: ApiError<unknown>): FalValidationIssue[] {
  if (!(error instanceof ValidationError)) {
    return [];
  }

  return error.fieldErrors.flatMap((issue) => {
    if (
      !issue ||
      typeof issue !== 'object' ||
      typeof issue.msg !== 'string' ||
      !Array.isArray(issue.loc)
    ) {
      return [];
    }

    return [{
      path: issue.loc.filter(
        (part): part is string | number =>
          typeof part === 'string' || typeof part === 'number',
      ),
      message: issue.msg,
      ...(typeof issue.type === 'string' ? { type: issue.type } : {}),
    }];
  });
}

function readFalRequestId(error: ApiError<unknown>): string | undefined {
  const capturedRequestId =
    'falRequestId' in error && typeof error.falRequestId === 'string'
      ? error.falRequestId
      : undefined;
  return firstNonEmptyString(capturedRequestId, error.requestId);
}

function firstNonEmptyString(
  ...values: Array<string | undefined>
): string | undefined {
  return values.find((value) => typeof value === 'string' && value.length > 0);
}

function classifyFalApiError(
  status: number,
  retryable: boolean,
): ProviderErrorKind {
  if (status === 429) {
    return 'rate_limited';
  }
  if (status >= 400 && status < 500) {
    return 'user_input';
  }
  if (retryable || status >= 500) {
    return 'transient';
  }
  return 'unknown';
}

function formatFalApiErrorMessage(input: {
  status: number;
  fallbackMessage: string;
  validationIssues: FalValidationIssue[];
  providerRequestId?: string;
}): string {
  const details = uniqueStrings(
    input.validationIssues.map(formatFalValidationIssue),
  );
  const description =
    details.length > 0 ? details.join('; ') : input.fallbackMessage;
  const action = input.status === 422 ? 'rejected the request' : 'request failed';
  const requestId = input.providerRequestId
    ? ` (request ID: ${input.providerRequestId})`
    : '';
  return `fal.ai ${action} (${input.status}): ${description}${requestId}`;
}

function formatFalValidationIssue(issue: FalValidationIssue): string {
  const path = issue.path[0] === 'body' ? issue.path.slice(1) : issue.path;
  return path.length > 0
    ? `${path.join('.')}: ${issue.message}`
    : issue.message;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
