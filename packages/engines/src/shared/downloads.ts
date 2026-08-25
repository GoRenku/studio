import { mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, extname, join } from 'node:path';
import type {
  GeneratedMediaArtifact,
  JsonValue,
  ProviderExecutionContext,
} from '../media/contracts.js';
import { EngineError } from './errors.js';
import { withProviderRetries } from './retry.js';
import { createRequestTimeoutFetch } from './request-timeout.js';

export async function downloadProviderOutputs(input: {
  provider: string;
  model: string;
  requestId?: string;
  urls: string[];
  context: ProviderExecutionContext;
  providerOutput?: JsonValue;
}): Promise<GeneratedMediaArtifact[]> {
  await mkdir(input.context.outputDirectory, { recursive: true });
  const artifacts: GeneratedMediaArtifact[] = [];
  for (const [index, url] of input.urls.entries()) {
    artifacts.push(await downloadProviderOutput({ ...input, url, index }));
  }
  return artifacts;
}

async function downloadProviderOutput(input: {
  provider: string;
  model: string;
  requestId?: string;
  url: string;
  index: number;
  context: ProviderExecutionContext;
  providerOutput?: JsonValue;
}): Promise<GeneratedMediaArtifact> {
  const response = await withProviderRetries({
    provider: input.provider,
    model: input.model,
    context: input.context,
    maxAttempts: 3,
    operation: async () => {
      let result: Response;
      try {
        result = await createRequestTimeoutFetch({
          provider: input.provider,
          model: input.model,
          requestId: input.requestId,
          context: input.context,
        })(input.url);
      } catch (error) {
        throw downloadError(input, 'Provider output could not be downloaded.', error);
      }
      if (!result.ok) {
        throw downloadError(
          input,
          `Provider output download failed with HTTP ${result.status}.`,
          undefined,
          result.status,
          readRetryAfter(result),
        );
      }
      return result;
    },
    classify: (error) => error instanceof EngineError
      ? { retryable: error.retryable, retryAfterMs: error.retryAfterMs }
      : { retryable: false },
  });
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw downloadError(input, 'Provider output download was empty.');
  }
  const mimeType = normalizeMimeType(response.headers.get('content-type'));
  const extension = extensionFor(mimeType, input.url);
  const destination = join(
    input.context.outputDirectory,
    `output-${String(input.index + 1).padStart(2, '0')}${extension}`,
  );
  const temporary = `${destination}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, bytes, { flag: 'wx' });
    await rename(temporary, destination);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw downloadError(input, 'Provider output could not be saved.', error);
  }
  const saved = await stat(destination);
  return {
    path: destination,
    mimeType,
    byteLength: saved.size,
    ...(input.providerOutput === undefined
      ? {}
      : { providerOutput: input.providerOutput }),
  };
}

function downloadError(
  input: { provider: string; model: string; requestId?: string },
  message: string,
  cause?: unknown,
  httpStatus?: number,
  retryAfterMs?: number,
): EngineError {
  return new EngineError('ENGINE_DOWNLOAD_FAILED', message, {
    provider: input.provider,
    model: input.model,
    requestId: input.requestId,
    httpStatus,
    retryable: httpStatus === undefined || httpStatus === 429 || httpStatus >= 500,
    retryAfterMs,
    cause,
  });
}

function readRetryAfter(response: Response): number | undefined {
  const value = response.headers.get('retry-after');
  if (!value) {
    return undefined;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1_000);
  }
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

function normalizeMimeType(value: string | null): string {
  return value?.split(';')[0]?.trim() || 'application/octet-stream';
}

function extensionFor(mimeType: string, url: string): string {
  const known: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/ogg': '.ogg',
  };
  if (known[mimeType]) {
    return known[mimeType];
  }
  try {
    const extension = extname(basename(new URL(url).pathname));
    return /^\.[a-z0-9]{1,8}$/i.test(extension) ? extension : '.bin';
  } catch {
    return '.bin';
  }
}
