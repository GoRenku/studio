import { createProviderError } from '../errors.js';

const WORLD_LABS_BASE_URL = 'https://api.worldlabs.ai';

export async function worldLabsJsonRequest<T>(input: {
  fetch: typeof fetch;
  apiKey: string;
  path: string;
  method: 'GET' | 'POST';
  body?: unknown;
  signal?: AbortSignal;
}): Promise<T> {
  const response = await worldLabsFetch({
    fetch: input.fetch,
    url: `${WORLD_LABS_BASE_URL}${input.path}`,
    init: {
      method: input.method,
      headers: {
        'WLT-Api-Key': input.apiKey,
        ...(input.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
      signal: input.signal,
    },
    signal: input.signal,
  });
  if (!response.ok) {
    throw createProviderError(
      'WORLD_LABS_HTTP_ERROR',
      `World Labs request failed with HTTP ${response.status}.`,
      {
        kind: response.status === 402 || response.status === 422
          ? 'user_input'
          : 'unknown',
        retryable: response.status >= 500,
        metadata: { status: response.status },
      }
    );
  }
  try {
    return await response.json() as T;
  } catch {
    throw createProviderError(
      'WORLD_LABS_RESPONSE_INVALID',
      'World Labs returned malformed JSON.'
    );
  }
}

export async function uploadWorldLabsMedia(input: {
  fetch: typeof fetch;
  uploadUrl: string;
  uploadMethod: string;
  requiredHeaders: Record<string, string>;
  bytes: Uint8Array;
  signal?: AbortSignal;
}): Promise<void> {
  const response = await worldLabsFetch({
    fetch: input.fetch,
    url: input.uploadUrl,
    init: {
      method: input.uploadMethod,
      headers: input.requiredHeaders,
      body: input.bytes,
      signal: input.signal,
    },
    signal: input.signal,
  });
  if (!response.ok) {
    throw createProviderError(
      'WORLD_LABS_UPLOAD_FAILED',
      `World Labs media upload failed with HTTP ${response.status}.`,
      { retryable: response.status >= 500, metadata: { status: response.status } }
    );
  }
}

export async function downloadWorldLabsSpz(input: {
  fetch: typeof fetch;
  url: string;
  signal?: AbortSignal;
}): Promise<{ body: ReadableStream<Uint8Array>; contentLength: number | null }> {
  const response = await worldLabsFetch({
    fetch: input.fetch,
    url: input.url,
    init: { signal: input.signal },
    signal: input.signal,
  });
  if (!response.ok) {
    throw createProviderError(
      'WORLD_LABS_DOWNLOAD_FAILED',
      `World Labs SPZ download failed with HTTP ${response.status}.`,
      { retryable: response.status >= 500, metadata: { status: response.status } }
    );
  }
  if (!response.body) {
    throw createProviderError(
      'WORLD_LABS_OUTPUT_MISSING',
      'World Labs returned no SPZ response body.'
    );
  }
  const contentLengthHeader = response.headers.get('content-length');
  const parsedLength = contentLengthHeader
    ? Number.parseInt(contentLengthHeader, 10)
    : Number.NaN;
  return {
    body: response.body,
    contentLength: Number.isFinite(parsedLength) ? parsedLength : null,
  };
}

async function worldLabsFetch(input: {
  fetch: typeof fetch;
  url: string;
  init: NonNullable<Parameters<typeof fetch>[1]>;
  signal?: AbortSignal;
}): Promise<Response> {
  try {
    return await input.fetch(input.url, input.init);
  } catch {
    if (input.signal?.aborted) {
      throw createProviderError(
        'WORLD_LABS_REQUEST_ABORTED',
        'World Labs request was cancelled.',
        { kind: 'user_input', causedByUser: true }
      );
    }
    throw createProviderError(
      'WORLD_LABS_NETWORK_ERROR',
      'World Labs could not be reached.',
      { retryable: true }
    );
  }
}
