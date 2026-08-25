import type { EngineLogger } from '../../media/contracts.js';
import { EngineError } from '../../shared/errors.js';

const WORLD_LABS_BASE_URL = 'https://api.worldlabs.ai';
const POLL_INTERVAL_MS = 2_000;

export type WorldLabsImageExtension = 'jpg' | 'jpeg' | 'png' | 'webp';

export interface WorldLabsLocationWorldImage {
  fileName: string;
  extension: WorldLabsImageExtension;
  mimeType: string;
  bytes: Uint8Array;
}

export type WorldLabsLocationWorldSource =
  | { kind: 'panorama'; image: WorldLabsLocationWorldImage }
  | { kind: 'multiImage'; images: WorldLabsLocationWorldImage[] };

export interface GenerateWorldLabsLocationWorldInput {
  displayName: string;
  prompt?: string;
  source: WorldLabsLocationWorldSource;
  credential: string;
  logger?: EngineLogger;
  signal?: AbortSignal;
  fetch?: typeof fetch;
  sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  requestTimeoutMs?: number;
  operationTimeoutMs?: number;
}

export interface WorldLabsLocationWorldResult {
  operationId: string;
  worldId: string;
  body: ReadableStream<Uint8Array>;
  contentLength: number | null;
  mediaKind: 'model';
  mimeType: 'application/octet-stream';
  extension: 'spz';
}

interface OperationResponse {
  operation_id?: unknown;
  done?: unknown;
  error?: { message?: unknown } | null;
  response?: unknown;
}

export async function generateWorldLabsLocationWorld(
  input: GenerateWorldLabsLocationWorldInput,
): Promise<WorldLabsLocationWorldResult> {
  validateInput(input);
  const request = input.fetch ?? fetch;
  const promptFields = input.prompt === undefined
    ? {}
    : { text_prompt: input.prompt, disable_recaption: true };
  const worldPrompt = input.source.kind === 'panorama'
    ? {
        type: 'image',
        image_prompt: await uploadSourceImage(request, input, input.source.image),
        is_pano: true,
        ...promptFields,
      }
    : {
        type: 'multi-image',
        multi_image_prompt: await Promise.all(input.source.images.map(async (image) => ({
          content: await uploadSourceImage(request, input, image),
        }))),
        reconstruct_images: true,
        ...promptFields,
      };
  const started = await jsonRequest<OperationResponse>(request, input, {
    path: '/marble/v1/worlds:generate',
    method: 'POST',
    body: {
      display_name: input.displayName,
      model: 'marble-1.1',
      world_prompt: worldPrompt,
    },
  });
  const operationId = requireString(
    started.operation_id,
    'World Labs did not return an operation id.',
  );
  input.logger?.info?.('providers.world-labs.location-world.started', {
    operationId,
    model: 'marble-1.1',
  });
  const completed = await pollForWorld(request, input, operationId);
  const response = await safeFetch(request, input, completed.fullResolutionSpzUrl);
  if (!response.ok || !response.body) {
    throw new EngineError(
      'ENGINE_DOWNLOAD_FAILED',
      `World Labs SPZ download failed with HTTP ${response.status}.`,
      {
        provider: 'world-labs',
        model: 'marble-1.1',
        requestId: operationId,
        httpStatus: response.status,
        retryable: response.status >= 500,
      },
    );
  }
  const contentLength = Number(response.headers.get('content-length'));
  return {
    operationId,
    worldId: completed.worldId,
    body: response.body,
    contentLength: Number.isFinite(contentLength) ? contentLength : null,
    mediaKind: 'model',
    mimeType: 'application/octet-stream',
    extension: 'spz',
  };
}

async function uploadSourceImage(
  request: typeof fetch,
  input: GenerateWorldLabsLocationWorldInput,
  image: WorldLabsLocationWorldImage,
): Promise<{ source: 'media_asset'; media_asset_id: string }> {
  const prepared = await jsonRequest<Record<string, unknown>>(request, input, {
    path: '/marble/v1/media-assets:prepare_upload',
    method: 'POST',
    body: { file_name: image.fileName, extension: image.extension, kind: 'image' },
  });
  const mediaAsset = isRecord(prepared.media_asset) ? prepared.media_asset : null;
  const upload = isRecord(prepared.upload_info) ? prepared.upload_info : null;
  const mediaAssetId = requireString(
    mediaAsset?.media_asset_id,
    'World Labs did not return a media asset id.',
  );
  const uploadUrl = requireString(upload?.upload_url, 'World Labs did not return an upload URL.');
  const uploadMethod = requireString(upload?.upload_method, 'World Labs did not return an upload method.');
  if (!isStringRecord(upload?.required_headers)) {
    throw invalidOutput('World Labs did not return required upload headers.');
  }
  const response = await safeFetch(request, input, uploadUrl, {
    method: uploadMethod,
    headers: upload.required_headers,
    body: image.bytes,
    signal: input.signal,
  });
  if (!response.ok) {
    throw new EngineError('ENGINE_UPLOAD_FAILED', `World Labs upload failed with HTTP ${response.status}.`, {
      provider: 'world-labs', model: 'marble-1.1', httpStatus: response.status,
      retryable: response.status >= 500,
    });
  }
  return { source: 'media_asset', media_asset_id: mediaAssetId };
}

async function pollForWorld(
  request: typeof fetch,
  input: GenerateWorldLabsLocationWorldInput,
  operationId: string,
): Promise<{ worldId: string; fullResolutionSpzUrl: string }> {
  const startedAt = Date.now();
  const timeout = input.operationTimeoutMs ?? 30 * 60_000;
  for (;;) {
    const operation = await jsonRequest<OperationResponse>(request, input, {
      path: `/marble/v1/operations/${encodeURIComponent(operationId)}`,
      method: 'GET',
    });
    if (operation.done === true) {
      if (operation.error) {
        throw new EngineError(
          'ENGINE_JOB_FAILED',
          typeof operation.error.message === 'string'
            ? operation.error.message
            : 'World Labs generation failed.',
          { provider: 'world-labs', model: 'marble-1.1', requestId: operationId },
        );
      }
      return readCompletedWorld(operation.response);
    }
    if (operation.done !== false) {
      throw invalidOutput('World Labs returned an invalid operation state.', operationId);
    }
    if (Date.now() - startedAt >= timeout) {
      throw new EngineError(
        'ENGINE_OPERATION_TIMEOUT',
        'World Labs generation exceeded its polling deadline.',
        {
          provider: 'world-labs', model: 'marble-1.1', requestId: operationId,
          retryable: true,
        },
      );
    }
    await (input.sleep ?? wait)(POLL_INTERVAL_MS, input.signal);
  }
}

async function jsonRequest<T>(
  request: typeof fetch,
  input: GenerateWorldLabsLocationWorldInput,
  operation: { path: string; method: 'GET' | 'POST'; body?: unknown },
): Promise<T> {
  const response = await safeFetch(request, input, `${WORLD_LABS_BASE_URL}${operation.path}`, {
    method: operation.method,
    headers: {
      'WLT-Api-Key': input.credential,
      ...(operation.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(operation.body === undefined ? {} : { body: JSON.stringify(operation.body) }),
    signal: input.signal,
  });
  if (!response.ok) {
    const code = response.status === 401 || response.status === 403
      ? 'ENGINE_AUTHENTICATION_FAILED'
      : response.status === 429
        ? 'ENGINE_RATE_LIMITED'
        : response.status >= 400 && response.status < 500
          ? 'ENGINE_REQUEST_REJECTED'
          : 'ENGINE_PROVIDER_UNAVAILABLE';
    throw new EngineError(code, `World Labs request failed with HTTP ${response.status}.`, {
      provider: 'world-labs', model: 'marble-1.1', httpStatus: response.status,
      retryable: response.status === 429 || response.status >= 500,
    });
  }
  try {
    return await response.json() as T;
  } catch (error) {
    throw new EngineError('ENGINE_OUTPUT_INVALID', 'World Labs returned malformed JSON.', {
      provider: 'world-labs', model: 'marble-1.1', cause: error,
    });
  }
}

async function safeFetch(
  request: typeof fetch,
  input: GenerateWorldLabsLocationWorldInput,
  url: string,
  init?: Parameters<typeof fetch>[1],
): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(Math.max(1, input.requestTimeoutMs ?? 30_000));
  const signals = [timeoutSignal];
  if (input.signal) {
    signals.push(input.signal);
  }
  if (init?.signal) {
    signals.push(init.signal);
  }
  try {
    return await request(url, { ...init, signal: AbortSignal.any(signals) });
  } catch (error) {
    const timedOut = timeoutSignal.aborted && !input.signal?.aborted;
    throw new EngineError(
      input.signal?.aborted ? 'ENGINE_CANCELLED' : 'ENGINE_PROVIDER_UNAVAILABLE',
      input.signal?.aborted
        ? 'World Labs generation was cancelled.'
        : timedOut
          ? 'World Labs request timed out.'
          : 'World Labs could not be reached.',
      {
        provider: 'world-labs', model: 'marble-1.1',
        retryable: !input.signal?.aborted, cause: error,
      },
    );
  }
}

function validateInput(input: GenerateWorldLabsLocationWorldInput): void {
  if (!input.credential.trim()) {
    throw new EngineError('ENGINE_AUTHENTICATION_FAILED', 'World Labs credential is required.', {
      provider: 'world-labs', model: 'marble-1.1',
    });
  }
  if (input.source.kind === 'multiImage'
    && (input.source.images.length < 2 || input.source.images.length > 8)) {
    throw new EngineError(
      'ENGINE_REQUEST_INVALID',
      'World Labs reconstruction requires between two and eight images.',
      { provider: 'world-labs', model: 'marble-1.1' },
    );
  }
}

function readCompletedWorld(value: unknown): {
  worldId: string;
  fullResolutionSpzUrl: string;
} {
  if (!isRecord(value)) {
    throw invalidOutput('World Labs completed without a World response.');
  }
  const assets = isRecord(value.assets) ? value.assets : null;
  const splats = assets && isRecord(assets.splats) ? assets.splats : null;
  const urls = splats && isRecord(splats.spz_urls) ? splats.spz_urls : null;
  return {
    worldId: requireString(value.world_id, 'World Labs did not return a World id.'),
    fullResolutionSpzUrl: requireString(urls?.full_res, 'World Labs did not return a full-resolution SPZ.'),
  };
}

function requireString(value: unknown, message: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw invalidOutput(message);
  }
  return value;
}

function invalidOutput(message: string, requestId?: string): EngineError {
  return new EngineError('ENGINE_OUTPUT_INVALID', message, {
    provider: 'world-labs', model: 'marble-1.1', requestId,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');
}

function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      clearTimeout(timeout);
      reject(signal?.reason);
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
