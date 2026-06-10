import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveRenkuConfigDir, type RenkuConfigPathOptions } from '../renku-config.js';
import { studioCoordinationWarning, StudioCoordinationError } from './errors.js';
import { formatStudioEventCursor, parseStudioEventCursor } from './event-cursors.js';
import { validateStudioEvent } from './event-validation.js';
import type { StudioEvent, StudioEventReadResult } from './events.js';

export const STUDIO_EVENTS_FILE_NAME = 'studio-events.jsonl' as const;

let appendQueue = Promise.resolve();

export function resolveStudioEventStorePath(options: RenkuConfigPathOptions = {}): string {
  return path.join(resolveRenkuConfigDir(options), STUDIO_EVENTS_FILE_NAME);
}

export async function appendStudioEventToStore(
  event: StudioEvent,
  options: RenkuConfigPathOptions = {}
): Promise<void> {
  validateStudioEvent(event);
  appendQueue = appendQueue.catch(() => undefined).then(() => appendNow(event, options));
  return appendQueue;
}

export async function readStudioEventsFromStore(
  input: { after?: string } & RenkuConfigPathOptions = {}
): Promise<StudioEventReadResult> {
  const offset = parseStudioEventCursor(input.after);
  const eventStorePath = resolveStudioEventStorePath(input);
  let fileHandle: fs.FileHandle | null = null;
  try {
    fileHandle = await fs.open(eventStorePath, 'r');
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return { events: [], nextCursor: '0', warnings: [] };
    }
    throw new StudioCoordinationError(
      'STUDIO_COORDINATION006',
      `Unable to open Studio coordination event store at ${eventStorePath}.`,
      { suggestion: 'Check that the Renku config directory is readable.' }
    );
  }

  try {
    const stats = await fileHandle.stat();
    if (offset > stats.size) {
      throw new StudioCoordinationError(
        'STUDIO_COORDINATION002',
        'Studio event cursor is beyond the end of the event store.',
        {
          suggestion: 'Start polling again without an after cursor.',
        }
      );
    }
    const buffer = Buffer.alloc(stats.size - offset);
    await fileHandle.read(buffer, 0, buffer.length, offset);
    return parseEventLines(buffer.toString('utf8'), offset);
  } finally {
    await fileHandle.close();
  }
}

async function appendNow(
  event: StudioEvent,
  options: RenkuConfigPathOptions
): Promise<void> {
  const eventStorePath = resolveStudioEventStorePath(options);
  let fileHandle: fs.FileHandle | null = null;
  try {
    await fs.mkdir(path.dirname(eventStorePath), { recursive: true });
    fileHandle = await fs.open(eventStorePath, 'a');
    await fileHandle.write(`${JSON.stringify(event)}\n`);
  } catch (error) {
    throw new StudioCoordinationError(
      'STUDIO_COORDINATION001',
      `Unable to append Studio coordination event at ${eventStorePath}: ${formatFileSystemCause(error)}.`,
      {
        suggestion:
          'Check that the Renku config directory exists, is a directory, and is writable by this process.',
      }
    );
  } finally {
    if (fileHandle) {
      await fileHandle.close();
    }
  }
}

function parseEventLines(contents: string, offset: number): StudioEventReadResult {
  const events: StudioEvent[] = [];
  const warnings = [];
  let cursor = offset;
  const lines = contents.split('\n');
  const completeLineCount = contents.endsWith('\n') ? lines.length - 1 : lines.length - 1;

  for (let index = 0; index < completeLineCount; index += 1) {
    const line = lines[index] ?? '';
    cursor += Buffer.byteLength(line, 'utf8') + 1;
    if (!line.trim()) {
      continue;
    }
    try {
      events.push(validateStudioEvent(JSON.parse(line)));
    } catch {
      warnings.push(
        studioCoordinationWarning(
          'STUDIO_COORDINATION007',
          'Malformed Studio coordination event line was skipped.',
          ['events', String(index)],
          'Continue with later valid events and inspect the local event store if this repeats.'
        )
      );
    }
  }

  return {
    events,
    nextCursor: formatStudioEventCursor(cursor),
    warnings,
  };
}

interface NodeError extends Error {
  code?: string;
}

function isNodeError(error: unknown): error is NodeError {
  return error instanceof Error && 'code' in error;
}

function formatFileSystemCause(error: unknown): string {
  if (isNodeError(error)) {
    const code = typeof error.code === 'string' ? `${error.code}: ` : '';
    return `${code}${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
