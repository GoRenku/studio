import type { JsonValue } from '../../media/contracts.js';
import {
  EngineError,
  type EngineErrorCode,
} from '../../shared/errors.js';

export interface PikaJob {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  error?: {
    code: string;
  };
}

export class PikaTerminalJobError extends EngineError {
  readonly terminalJobFailure = true;
}

export async function readPikaResponseBody(response: Response): Promise<JsonValue | undefined> {
  try {
    const value = await response.json() as unknown;
    return isJsonValue(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function parsePikaJob(
  value: JsonValue | undefined,
  input: {
    model: string;
    fallbackCode: 'ENGINE_SUBMIT_FAILED' | 'ENGINE_POLL_FAILED' | 'ENGINE_RECOVERY_FAILED';
    requestId?: string;
  },
): PikaJob {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || value.id.length === 0
    || !isJobStatus(value.status)) {
    throw new EngineError(
      input.fallbackCode,
      'Pika returned a malformed media job.',
      { provider: 'pika', model: input.model, requestId: input.requestId },
    );
  }
  if (value.status !== 'failed') {
    return { id: value.id, status: value.status };
  }
  const error = isRecord(value.error) && typeof value.error.code === 'string'
    ? { code: value.error.code }
    : { code: 'provider_error' };
  return { id: value.id, status: value.status, error };
}

export function pikaJobFailure(
  job: PikaJob,
  model: string,
  retryAfterMs?: number,
): PikaTerminalJobError {
  const code = normalizeJobErrorCode(job.error?.code);
  const engineCode = jobErrorCode(code);
  return new PikaTerminalJobError(
    engineCode,
    `Pika media job ${job.id} failed (${code}).`,
    {
      provider: 'pika',
      model,
      requestId: job.id,
      retryable: code === 'rate_limited' || code === 'provider_unavailable',
      ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
    },
  );
}

export function pikaHttpError(input: {
  response: Response;
  model: string;
  fallbackCode: EngineErrorCode;
  operation: 'metadata' | 'upload' | 'submit' | 'poll' | 'recover' | 'content';
  requestId?: string;
}): EngineError {
  const status = input.response.status;
  const code = httpErrorCode(status, input.fallbackCode, input.operation);
  return new EngineError(
    code,
    `Pika ${input.operation} request failed with HTTP ${status}.`,
    {
      provider: 'pika',
      model: input.model,
      requestId: input.requestId,
      httpStatus: status,
      retryable: status === 429 || status === 503,
      ...(readRetryAfter(input.response) === undefined
        ? {}
        : { retryAfterMs: readRetryAfter(input.response) }),
    },
  );
}

export function readRetryAfter(response: Response): number | undefined {
  const value = response.headers.get('retry-after');
  if (!value) {
    return undefined;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.min(Math.max(0, seconds * 1_000), 60_000);
  }
  const date = Date.parse(value);
  return Number.isFinite(date)
    ? Math.min(Math.max(0, date - Date.now()), 60_000)
    : undefined;
}

function httpErrorCode(
  status: number,
  fallback: EngineErrorCode,
  operation: string,
): EngineErrorCode {
  if (status === 401 || status === 403) {
    return 'ENGINE_AUTHENTICATION_FAILED';
  }
  if (status === 404) {
    if (operation === 'metadata') {
      return 'ENGINE_METADATA_UNAVAILABLE';
    }
    if (operation === 'recover') {
      return 'ENGINE_RECOVERY_FAILED';
    }
    return operation === 'content' ? 'ENGINE_OUTPUT_INVALID' : fallback;
  }
  if ((status === 413 || status === 415) && operation === 'upload') {
    return 'ENGINE_LOCAL_MEDIA_INVALID';
  }
  if (status === 422) {
    return 'ENGINE_REQUEST_INVALID';
  }
  if (status === 429) {
    return 'ENGINE_RATE_LIMITED';
  }
  if (status === 503) {
    return 'ENGINE_PROVIDER_UNAVAILABLE';
  }
  if (status === 409) {
    return 'ENGINE_REQUEST_REJECTED';
  }
  return fallback;
}

function jobErrorCode(code: string): EngineErrorCode {
  switch (code) {
    case 'invalid_input':
      return 'ENGINE_REQUEST_INVALID';
    case 'content_moderation':
    case 'insufficient_balance':
    case 'membership_required':
    case 'cycle_limit_exceeded':
    case 'admission_suspended':
      return 'ENGINE_REQUEST_REJECTED';
    case 'rate_limited':
      return 'ENGINE_RATE_LIMITED';
    case 'provider_unavailable':
      return 'ENGINE_PROVIDER_UNAVAILABLE';
    case 'provider_timeout':
    case 'timed_out':
      return 'ENGINE_OPERATION_TIMEOUT';
    default:
      return 'ENGINE_JOB_FAILED';
  }
}

function normalizeJobErrorCode(value: string | undefined): string {
  const known = [
    'invalid_input',
    'content_moderation',
    'provider_error',
    'provider_timeout',
    'provider_unavailable',
    'rate_limited',
    'insufficient_balance',
    'membership_required',
    'cycle_limit_exceeded',
    'admission_suspended',
    'timed_out',
    'internal',
  ];
  return value && known.includes(value) ? value : 'provider_error';
}

function isJobStatus(value: JsonValue | undefined): value is PikaJob['status'] {
  return value === 'queued' || value === 'running' || value === 'completed' || value === 'failed';
}

function isRecord(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isJsonValue(value: unknown, depth = 0): value is JsonValue {
  if (depth > 100) {
    return false;
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return true;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every((entry) => isJsonValue(entry, depth + 1));
  }
  return value !== null
    && typeof value === 'object'
    && Object.values(value).every((entry) => isJsonValue(entry, depth + 1));
}
