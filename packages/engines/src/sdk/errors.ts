import { SdkErrorCode, type SdkErrorCodeValue } from '#core';

export { SdkErrorCode };

export type ProviderErrorKind = 'rate_limited' | 'transient' | 'user_input' | 'unknown';

export interface ProviderError extends Error {
  code: string;
  kind: ProviderErrorKind;
  retryable: boolean;
  causedByUser?: boolean;
  metadata?: Record<string, unknown>;
  raw?: unknown;
}

export interface ProviderFailureDetails {
  message: string;
  causeMessage?: string;
  code?: string;
  errno?: string | number;
  syscall?: string;
  hostname?: string;
  address?: string;
  port?: number;
}

export function createProviderError(
  code: SdkErrorCodeValue | string,
  message: string,
  options: {
    kind?: ProviderErrorKind;
    retryable?: boolean;
    causedByUser?: boolean;
    metadata?: Record<string, unknown>;
    raw?: unknown;
  } = {},
): ProviderError {
  const error = new Error(message) as ProviderError;
  error.code = code;
  error.kind = options.kind ?? 'unknown';
  error.retryable = options.retryable ?? false;
  error.causedByUser = options.causedByUser;
  error.metadata = options.metadata;
  error.raw = options.raw;
  return error;
}

export function readProviderFailureDetails(
  error: unknown
): ProviderFailureDetails {
  const message = readFailureMessage(error);
  const cause = readObjectProperty(error, 'cause');
  const causeMessage =
    cause === undefined ? undefined : readFailureMessage(cause);
  const transportSource = isRecord(cause) ? cause : readRecord(error);
  const details: ProviderFailureDetails = { message };

  if (causeMessage && causeMessage !== message) {
    details.causeMessage = causeMessage;
  }
  if (transportSource) {
    const code = readStringProperty(transportSource, 'code');
    const errno = readStringOrNumberProperty(transportSource, 'errno');
    const syscall = readStringProperty(transportSource, 'syscall');
    const hostname = readStringProperty(transportSource, 'hostname');
    const address = readStringProperty(transportSource, 'address');
    const port = readNumberProperty(transportSource, 'port');

    if (code) {
      details.code = code;
    }
    if (errno !== undefined) {
      details.errno = errno;
    }
    if (syscall) {
      details.syscall = syscall;
    }
    if (hostname) {
      details.hostname = hostname;
    }
    if (address) {
      details.address = address;
    }
    if (port !== undefined) {
      details.port = port;
    }
  }

  return details;
}

export function formatProviderFailure(error: unknown): string {
  const details = readProviderFailureDetails(error);
  const parts = [details.message];
  if (details.causeMessage) {
    parts.push(`cause: ${details.causeMessage}`);
  }

  const transport = [
    details.code ? `code=${details.code}` : undefined,
    details.syscall ? `syscall=${details.syscall}` : undefined,
    details.hostname ? `hostname=${details.hostname}` : undefined,
    details.address ? `address=${details.address}` : undefined,
    details.port !== undefined ? `port=${details.port}` : undefined,
  ].filter((part): part is string => Boolean(part));

  if (transport.length > 0) {
    parts.push(`transport: ${transport.join(', ')}`);
  }

  return parts.join('; ');
}

function readFailureMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}

function readObjectProperty(value: unknown, property: string): unknown {
  return isRecord(value) ? value[property] : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function readStringProperty(
  source: Record<string, unknown>,
  property: string
): string | undefined {
  const value = source[property];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readStringOrNumberProperty(
  source: Record<string, unknown>,
  property: string
): string | number | undefined {
  const value = source[property];
  if (
    (typeof value === 'string' && value.length > 0) ||
    typeof value === 'number'
  ) {
    return value;
  }
  return undefined;
}

function readNumberProperty(
  source: Record<string, unknown>,
  property: string
): number | undefined {
  const value = source[property];
  return typeof value === 'number' ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
