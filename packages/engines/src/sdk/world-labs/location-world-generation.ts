import { createProviderError } from '../errors.js';
import { loadProviderEnvFiles } from '../../provider-env-files.js';
import type {
  GenerateWorldLabsLocationWorldInput,
  WorldLabsCompletedWorld,
  WorldLabsLocationWorldImage,
  WorldLabsLocationWorldResult,
  WorldLabsPreparedUpload,
} from './contracts.js';
import {
  downloadWorldLabsSpz,
  uploadWorldLabsMedia,
  worldLabsJsonRequest,
} from './client.js';

const POLL_INTERVAL_MS = 2_000;

interface PrepareUploadResponse {
  media_asset?: { media_asset_id?: unknown };
  upload_info?: {
    upload_url?: unknown;
    upload_method?: unknown;
    required_headers?: unknown;
  };
}

interface OperationResponse {
  operation_id?: unknown;
  done?: unknown;
  error?: { message?: unknown } | null;
  response?: unknown;
}

export async function generateWorldLabsLocationWorld(
  input: GenerateWorldLabsLocationWorldInput
): Promise<WorldLabsLocationWorldResult> {
  validateSource(input.source);
  const apiKey = await resolveApiKey(input);
  const request = input.fetch ?? fetch;
  const promptFields = input.prompt === undefined
    ? {}
    : { text_prompt: input.prompt, disable_recaption: true };
  let worldPrompt: Record<string, unknown>;
  if (input.source.kind === 'panorama') {
    const uploaded = await uploadSourceImage({
      request,
      apiKey,
      image: input.source.image,
      signal: input.signal,
    });
    worldPrompt = {
      type: 'image',
      image_prompt: uploaded,
      is_pano: true,
      ...promptFields,
    };
  } else {
    const uploadedImages = [];
    for (const image of input.source.images) {
      uploadedImages.push({
        content: await uploadSourceImage({
          request,
          apiKey,
          image,
          signal: input.signal,
        }),
      });
    }
    worldPrompt = {
      type: 'multi-image',
      multi_image_prompt: uploadedImages,
      reconstruct_images: true,
      ...promptFields,
    };
  }

  const started = await worldLabsJsonRequest<OperationResponse>({
    fetch: request,
    apiKey,
    path: '/marble/v1/worlds:generate',
    method: 'POST',
    body: {
      display_name: input.displayName,
      model: 'marble-1.1',
      world_prompt: worldPrompt,
    },
    signal: input.signal,
  });
  const operationId = requireString(
    started.operation_id,
    'World Labs did not return an operation id.'
  );
  input.logger?.info?.('providers.world-labs.location-world.started', {
    operationId,
    model: 'marble-1.1',
  });
  const completed = await pollForWorld({
    request,
    apiKey,
    operationId,
    signal: input.signal,
    wait: input.wait ?? wait,
  });
  const downloaded = await downloadWorldLabsSpz({
    fetch: request,
    url: completed.fullResolutionSpzUrl,
    signal: input.signal,
  });
  return {
    operationId,
    worldId: completed.worldId,
    ...downloaded,
    mediaKind: 'model',
    mimeType: 'application/octet-stream',
    extension: 'spz',
  };
}

async function uploadSourceImage(input: {
  request: typeof fetch;
  apiKey: string;
  image: WorldLabsLocationWorldImage;
  signal?: AbortSignal;
}): Promise<{ source: 'media_asset'; media_asset_id: string }> {
  const prepared = await prepareUpload({
    request: input.request,
    apiKey: input.apiKey,
    fileName: input.image.fileName,
    extension: input.image.extension,
    signal: input.signal,
  });
  await uploadWorldLabsMedia({
    fetch: input.request,
    uploadUrl: prepared.uploadUrl,
    uploadMethod: prepared.uploadMethod,
    requiredHeaders: prepared.requiredHeaders,
    bytes: input.image.bytes,
    signal: input.signal,
  });
  return {
    source: 'media_asset',
    media_asset_id: prepared.mediaAssetId,
  };
}

async function prepareUpload(input: {
  request: typeof fetch;
  apiKey: string;
  fileName: string;
  extension: string;
  signal?: AbortSignal;
}): Promise<WorldLabsPreparedUpload> {
  const response = await worldLabsJsonRequest<PrepareUploadResponse>({
    fetch: input.request,
    apiKey: input.apiKey,
    path: '/marble/v1/media-assets:prepare_upload',
    method: 'POST',
    body: {
      file_name: input.fileName,
      extension: input.extension,
      kind: 'image',
    },
    signal: input.signal,
  });
  const headers = response.upload_info?.required_headers;
  if (!isStringRecord(headers)) {
    throw invalidResponse('World Labs did not return required upload headers.');
  }
  return {
    mediaAssetId: requireString(
      response.media_asset?.media_asset_id,
      'World Labs did not return a media asset id.'
    ),
    uploadUrl: requireString(
      response.upload_info?.upload_url,
      'World Labs did not return an upload URL.'
    ),
    uploadMethod: requireString(
      response.upload_info?.upload_method,
      'World Labs did not return an upload method.'
    ),
    requiredHeaders: headers,
  };
}

async function pollForWorld(input: {
  request: typeof fetch;
  apiKey: string;
  operationId: string;
  signal?: AbortSignal;
  wait: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
}): Promise<WorldLabsCompletedWorld> {
  for (;;) {
    const operation = await worldLabsJsonRequest<OperationResponse>({
      fetch: input.request,
      apiKey: input.apiKey,
      path: `/marble/v1/operations/${encodeURIComponent(input.operationId)}`,
      method: 'GET',
      signal: input.signal,
    });
    if (operation.done === true) {
      if (operation.error) {
        const message = typeof operation.error.message === 'string'
          ? operation.error.message
          : 'World Labs generation failed.';
        throw createProviderError(
          'WORLD_LABS_OPERATION_FAILED',
          message,
          { kind: 'user_input' }
        );
      }
      return readCompletedWorld(operation.response);
    }
    if (operation.done !== false) {
      throw invalidResponse('World Labs returned an invalid operation state.');
    }
    try {
      await input.wait(POLL_INTERVAL_MS, input.signal);
    } catch (error) {
      if (input.signal?.aborted) {
        throw createProviderError(
          'WORLD_LABS_REQUEST_ABORTED',
          'World Labs generation was cancelled.',
          { kind: 'user_input', causedByUser: true }
        );
      }
      throw error;
    }
  }
}

function validateSource(source: GenerateWorldLabsLocationWorldInput['source']) {
  if (
    source.kind === 'multiImage'
    && (source.images.length < 2 || source.images.length > 8)
  ) {
    throw createProviderError(
      'WORLD_LABS_IMAGES_INVALID',
      'World Labs Location World reconstruction requires between two and eight images.',
      { kind: 'user_input', causedByUser: true }
    );
  }
}

function readCompletedWorld(value: unknown): WorldLabsCompletedWorld {
  if (!isRecord(value)) {
    throw invalidResponse('World Labs completed without a World response.');
  }
  const assets = isRecord(value.assets) ? value.assets : null;
  const splats = assets && isRecord(assets.splats) ? assets.splats : null;
  const urls = splats && isRecord(splats.spz_urls) ? splats.spz_urls : null;
  return {
    worldId: requireString(value.world_id, 'World Labs did not return a World id.'),
    fullResolutionSpzUrl: requireString(
      urls?.full_res,
      'World Labs did not return a full-resolution SPZ.'
    ),
  };
}

async function resolveApiKey(
  input: GenerateWorldLabsLocationWorldInput
): Promise<string> {
  if (input.secretResolver) {
    const key = await input.secretResolver.getSecret('WLT_API_KEY');
    if (key) {
      return key;
    }
  } else {
    loadProviderEnvFiles();
    if (process.env.WLT_API_KEY) {
      return process.env.WLT_API_KEY;
    }
  }
  throw createProviderError(
    'WORLD_LABS_API_KEY_MISSING',
    'WLT_API_KEY is required to generate a Location World.',
    { kind: 'user_input', causedByUser: true }
  );
}

function requireString(value: unknown, message: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw invalidResponse(message);
  }
  return value;
}

function invalidResponse(message: string) {
  return createProviderError('WORLD_LABS_RESPONSE_INVALID', message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value)
    && Object.values(value).every((entry) => typeof entry === 'string');
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
