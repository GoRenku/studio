import { Buffer } from 'node:buffer';
import { createProviderError, SdkErrorCode } from '../errors.js';
import { generateMockPng } from './png-generator.js';
import { generateWavWithDuration } from './wav-generator.js';

const SIMULATED_MP3_BASE64 =
  'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYyLjEyLjEwMAAAAAAAAAAAAAAA/+MYxAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVV/+MYxDsAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVV/+MYxHYAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV/+MYxLEAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV/+MYxMQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV/+MYxMQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';
const SIMULATED_MP4_BASE64 =
  'AAAAJGZ0eXBpc29tAAACAGlzb21pc282aXNvMmF2YzFtcDQxAAAC5W1vb3YAAABsbXZoZAAAAAAAAAAAAAAAAAAAA+gAAAAAAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAHndHJhawAAAFx0a2hkAAAAAwAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAQAAAAEAAAAAABg21kaWEAAAAgbWRoZAAAAAAAAAAAAAAAAAAAQAAAAAAAVcQAAAAAAC1oZGxyAAAAAAAAAAB2aWRlAAAAAAAAAAAAAAAAVmlkZW9IYW5kbGVyAAAAAS5taW5mAAAAFHZtaGQAAAABAAAAAAAAAAAAAAAkZGluZgAAABxkcmVmAAAAAAAAAAEAAAAMdXJsIAAAAAEAAADuc3RibAAAAKJzdHNkAAAAAAAAAAEAAACSYXZjMQAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAQABAASAAAAEgAAAAAAAAAARVMYXZjNjIuMjguMTAwIGxpYngyNjQAAAAAAAAAAAAAABj//wAAACxhdmNDAULACv/hABVnQsAK2nsBEAAAAwAQAAADACDxImoBAARozg/IAAAAEHBhc3AAAAABAAAAAQAAABBzdHRzAAAAAAAAAAAAAAAQc3RzYwAAAAAAAAAAAAAAFHN0c3oAAAAAAAAAAAAAAAAAAAAQc3RjbwAAAAAAAAAAAAAAKG12ZXgAAAAgdHJleAAAAAAAAAABAAAAAQAAAAAAAAAAAAAAAAAAAGJ1ZHRhAAAAWm1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALWlsc3QAAAAlqXRvbwAAAB1kYXRhAAAAAQAAAABMYXZmNjIuMTIuMTAwAAAAcG1vb2YAAAAQbWZoZAAAAAAAAAABAAAAWHRyYWYAAAAkdGZoZAAAADkAAAABAAAAAAAAAwkAAEAAAAACZQEBAAAAAAAUdGZkdAEAAAAAAAAAAAAAAAAAABh0cnVuAAAABQAAAAEAAAB4AgAAAAAAAm1tZGF0AAACUwYF//9P3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE2NSByMzIyMiBiMzU2MDVhIC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAyNSAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTAgcmVmPTEgZGVibG9jaz0wOjA6MCBhbmFseXNlPTA6MCBtZT1kaWEgc3VibWU9MCBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0wIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MCA4eDhkY3Q9MCBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0wIHRocmVhZHM9MSBsb29rYWhlYWRfdGhyZWFkcz0xIHNsaWNlZF90aHJlYWRzPTAgbnI9MCBkZWNpbWF0ZT0xIGludGVybGFjZWQ9MCBibHVyYXlfY29tcGF0PTAgY29uc3RyYWluZWRfaW50cmE9MCBiZnJhbWVzPTAgd2VpZ2h0cD0wIGtleWludD0yNTAga2V5aW50X21pbj0xIHNjZW5lY3V0PTAgaW50cmFfcmVmcmVzaD0wIHJjPWNyZiBtYnRyZWU9MCBjcmY9MjMuMCBxY29tcD0wLjYwIHFwbWluPTAgcXBtYXg9NjkgcXBzdGVwPTQgaXBfcmF0aW89MS40MCBhcT0wAIAAAAAKZYiEOiYoAAkC4AAAAENtZnJhAAAAK3RmcmEBAAAAAAAAAQAAAAAAAAABAAAAAAAAAAAAAAAAAAADCQEBAQAAABBtZnJvAAAAAAAAAEM=';

export async function generateSimulatedDataForMimeType(args: {
  mimeType: string;
  durationSeconds: number;
}): Promise<Buffer> {
  const { mimeType, durationSeconds } = args;

  if (mimeType.startsWith('image/')) {
    return generateMockPng(100, 100);
  }

  if (mimeType.startsWith('video/')) {
    return generateSimulatedMp4(durationSeconds);
  }

  if (mimeType.startsWith('audio/')) {
    if (mimeType === 'audio/wav' || mimeType === 'audio/x-wav') {
      return generateWavWithDuration(durationSeconds);
    }
    if (mimeType === 'audio/mpeg' || mimeType === 'audio/mp3') {
      return generateSimulatedMp3(durationSeconds);
    }
  }

  throw createProviderError(
    SdkErrorCode.INVALID_CONFIG,
    `Simulated media generation does not support mime type "${mimeType}".`,
    {
      kind: 'user_input',
      causedByUser: true,
      metadata: { mimeType },
    }
  );
}

function generateSimulatedMp3(durationSeconds: number): Buffer {
  const source = Buffer.from(SIMULATED_MP3_BASE64, 'base64');
  const id3Length = 45;
  const frameLength = 72;
  const frameDurationSeconds = 0.072;
  const frameCount = Math.max(1, Math.round(durationSeconds / frameDurationSeconds));
  const id3 = source.subarray(0, id3Length);
  const silentFrame = source.subarray(id3Length, id3Length + frameLength);
  return Buffer.concat([
    id3,
    ...Array.from({ length: frameCount }, () => silentFrame),
  ]);
}

function generateSimulatedMp4(durationSeconds: number): Buffer {
  const buffer = Buffer.from(SIMULATED_MP4_BASE64, 'base64');
  const mediaHeaderOffset = buffer.indexOf('mdhd');
  const trackFragmentHeaderOffset = buffer.indexOf('tfhd');
  if (mediaHeaderOffset < 0 || trackFragmentHeaderOffset < 0) {
    throw new Error('Bundled simulated MP4 is missing required duration boxes.');
  }
  const timescale = buffer.readUInt32BE(mediaHeaderOffset + 16);
  buffer.writeUInt32BE(
    Math.max(1, Math.round(durationSeconds * timescale)),
    trackFragmentHeaderOffset + 20
  );
  return buffer;
}

export function resolveDurationForSimulatedMedia(args: {
  durationInputId?: string;
  resolvedInputs: Record<string, unknown> | undefined;
}): number {
  const { durationInputId, resolvedInputs } = args;
  if (!resolvedInputs) {
    throw createProviderError(
      SdkErrorCode.MISSING_DURATION,
      'Simulated media generation requires resolved inputs for the explicitly bound Duration input.',
      { kind: 'user_input', causedByUser: true }
    );
  }

  if (!durationInputId) {
    throw createProviderError(
      SdkErrorCode.MISSING_DURATION,
      'Simulated media generation requires an explicit binding for the producer Duration input.',
      {
        kind: 'user_input',
        causedByUser: true,
        metadata: {
          binding: 'Duration',
        },
      }
    );
  }

  if (!durationInputId.startsWith('Input:')) {
    throw createProviderError(
      SdkErrorCode.INVALID_CONFIG,
      `Simulated media generation received a non-canonical Duration binding "${durationInputId}".`,
      {
        kind: 'user_input',
        causedByUser: true,
        metadata: { durationInputId },
      }
    );
  }

  const durationValue = resolvedInputs[durationInputId];
  if (
    typeof durationValue === 'number' &&
    Number.isFinite(durationValue) &&
    durationValue > 0
  ) {
    return durationValue;
  }

  throw createProviderError(
    SdkErrorCode.MISSING_DURATION,
    `Simulated media generation requires a positive numeric value for bound Duration input "${durationInputId}".`,
    {
      kind: 'user_input',
      causedByUser: true,
      metadata: { durationInputId, durationValue },
    }
  );
}
