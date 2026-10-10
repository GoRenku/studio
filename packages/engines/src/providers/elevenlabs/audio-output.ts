import { mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type {
  GeneratedMediaArtifact,
  JsonValue,
  ProviderExecutionContext,
  ProviderExecutionResult,
} from '../../media/contracts.js';
import { EngineError } from '../../shared/errors.js';

export function outputFormat(input: Record<string, JsonValue>) {
  return (typeof input.output_format === 'string'
    ? input.output_format
    : 'mp3_44100_128') as 'mp3_44100_128';
}

export async function saveElevenLabsAudioStream(input: {
  stream: ReadableStream<Uint8Array>;
  nativeInput: Record<string, JsonValue>;
  model: string;
  context: ProviderExecutionContext;
}): Promise<ProviderExecutionResult> {
  const bytes = await collectStream(input.stream, input.model);
  const { mimeType, extension } = outputDescription(input.nativeInput);
  const artifact = await writeAudio(bytes, mimeType, extension, input.model, input.context);
  return {
    provider: 'elevenlabs',
    model: input.model,
    artifacts: [artifact],
    receipt: { byteLength: bytes.byteLength, outputFormat: outputFormat(input.nativeInput) },
  };
}

export async function writeAudio(
  bytes: Uint8Array,
  mimeType: string,
  extension: string,
  model: string,
  context: ProviderExecutionContext,
): Promise<GeneratedMediaArtifact> {
  await mkdir(context.outputDirectory, { recursive: true });
  const destination = join(context.outputDirectory, `output-01.${extension}`);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, bytes, { flag: 'wx' });
    await rename(temporary, destination);
    return {
      path: destination,
      mimeType,
      byteLength: (await stat(destination)).size,
    };
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw new EngineError('ENGINE_DOWNLOAD_FAILED', 'ElevenLabs audio could not be saved.', {
      provider: 'elevenlabs', model, cause: error,
    });
  }
}

async function collectStream(
  stream: ReadableStream<Uint8Array>,
  model: string,
): Promise<Uint8Array> {
  try {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    for (;;) {
      const next = await reader.read();
      if (next.done) {
        break;
      }
      chunks.push(next.value);
    }
    const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    if (bytes.byteLength === 0) {
      throw new Error('Audio stream was empty.');
    }
    return bytes;
  } catch (error) {
    throw new EngineError('ENGINE_OUTPUT_INVALID', 'ElevenLabs returned invalid audio.', {
      provider: 'elevenlabs', model, cause: error,
    });
  }
}

function outputDescription(input: Record<string, JsonValue>): {
  mimeType: string;
  extension: string;
} {
  const format = outputFormat(input);
  if (format.startsWith('pcm_') || format.startsWith('wav_')) {
    return { mimeType: 'audio/wav', extension: 'wav' };
  }
  if (format.startsWith('opus_')) {
    return { mimeType: 'audio/ogg', extension: 'ogg' };
  }
  return { mimeType: 'audio/mpeg', extension: 'mp3' };
}
