import type { JsonValue } from '../media/contracts.js';

export type EngineErrorCode =
  | 'ENGINE_PROVIDER_UNSUPPORTED'
  | 'ENGINE_AUTHENTICATION_FAILED'
  | 'ENGINE_METADATA_UNAVAILABLE'
  | 'ENGINE_METADATA_INVALID'
  | 'ENGINE_INPUT_SCHEMA_UNAVAILABLE'
  | 'ENGINE_REQUEST_INVALID'
  | 'ENGINE_LOCAL_MEDIA_INVALID'
  | 'ENGINE_UPLOAD_FAILED'
  | 'ENGINE_SUBMIT_FAILED'
  | 'ENGINE_REQUEST_REJECTED'
  | 'ENGINE_RATE_LIMITED'
  | 'ENGINE_PROVIDER_UNAVAILABLE'
  | 'ENGINE_POLL_FAILED'
  | 'ENGINE_JOB_FAILED'
  | 'ENGINE_OPERATION_TIMEOUT'
  | 'ENGINE_CANCELLED'
  | 'ENGINE_RECOVERY_UNSUPPORTED'
  | 'ENGINE_RECOVERY_FAILED'
  | 'ENGINE_OUTPUT_INVALID'
  | 'ENGINE_DOWNLOAD_FAILED';

export interface EngineErrorOptions {
  provider: string;
  model?: string;
  requestId?: string;
  httpStatus?: number;
  retryable?: boolean;
  retryAfterMs?: number;
  details?: JsonValue;
  cause?: unknown;
}

export class EngineError extends Error {
  readonly code: EngineErrorCode;
  readonly provider: string;
  readonly model?: string;
  readonly requestId?: string;
  readonly httpStatus?: number;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
  readonly details?: JsonValue;

  constructor(
    code: EngineErrorCode,
    message: string,
    options: EngineErrorOptions,
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'EngineError';
    this.code = code;
    this.provider = options.provider;
    this.model = options.model;
    this.requestId = options.requestId;
    this.httpStatus = options.httpStatus;
    this.retryable = options.retryable ?? false;
    this.retryAfterMs = options.retryAfterMs;
    this.details = options.details;
  }
}

export function isEngineError(error: unknown): error is EngineError {
  return error instanceof EngineError;
}

export function cancelledError(
  provider: string,
  model: string | undefined,
  cause?: unknown,
): EngineError {
  return new EngineError(
    'ENGINE_CANCELLED',
    'Media generation was cancelled.',
    { provider, model, cause },
  );
}
