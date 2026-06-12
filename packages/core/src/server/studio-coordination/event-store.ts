import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveRenkuConfigDir, type RenkuConfigPathOptions } from '../renku-config.js';
import { studioCoordinationWarning, StudioCoordinationError } from './errors.js';
import { formatStudioEventCursor, parseStudioEventCursor } from './event-cursors.js';
import { validateStudioEvent } from './event-validation.js';
import type { StudioEvent, StudioEventReadResult } from './events.js';

export const STUDIO_EVENTS_FILE_NAME = 'studio-events.jsonl' as const;

export interface StudioEventStoreSummary {
  path: string;
  exists: boolean;
  lineCount: number;
  invalidEventCount: number;
  warningCount: number;
}

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

export async function readStudioEventStoreSummary(
  options: RenkuConfigPathOptions = {}
): Promise<StudioEventStoreSummary> {
  const eventStorePath = resolveStudioEventStorePath(options);
  let contents: string;
  try {
    contents = await fs.readFile(eventStorePath, 'utf8');
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return {
        path: eventStorePath,
        exists: false,
        lineCount: 0,
        invalidEventCount: 0,
        warningCount: 0,
      };
    }
    throw new StudioCoordinationError(
      'STUDIO_COORDINATION006',
      `Unable to open Studio coordination event store at ${eventStorePath}.`,
      { suggestion: 'Check that the Renku config directory is readable.' }
    );
  }

  const lineCount = countCompleteEventLines(contents);
  const invalidEventCount = collectInvalidEventLineSummaries(contents).length;
  return {
    path: eventStorePath,
    exists: true,
    lineCount,
    invalidEventCount,
    warningCount: invalidEventCount > 0 ? 1 : 0,
  };
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
  const invalidLines: InvalidStudioEventLine[] = [];
  let cursor = offset;
  const lines = contents.split('\n');
  const completeLineCount = countCompleteEventLines(contents);

  for (let index = 0; index < completeLineCount; index += 1) {
    const line = lines[index] ?? '';
    cursor += Buffer.byteLength(line, 'utf8') + 1;
    if (!line.trim()) {
      continue;
    }
    try {
      events.push(validateStudioEvent(JSON.parse(line)));
    } catch (error) {
      invalidLines.push(invalidStudioEventLine(line, index, error));
    }
  }

  return {
    events,
    nextCursor: formatStudioEventCursor(cursor),
    warnings: summarizeInvalidEventLines(invalidLines),
  };
}

interface InvalidStudioEventLine {
  lineNumber: number;
  eventType?: string;
  reason: string;
}

function countCompleteEventLines(contents: string): number {
  return Math.max(0, contents.split('\n').length - 1);
}

function collectInvalidEventLineSummaries(
  contents: string
): InvalidStudioEventLine[] {
  const invalidLines: InvalidStudioEventLine[] = [];
  const lines = contents.split('\n');
  const completeLineCount = countCompleteEventLines(contents);

  for (let index = 0; index < completeLineCount; index += 1) {
    const line = lines[index] ?? '';
    if (!line.trim()) {
      continue;
    }
    try {
      validateStudioEvent(JSON.parse(line));
    } catch (error) {
      invalidLines.push(invalidStudioEventLine(line, index, error));
    }
  }

  return invalidLines;
}

function invalidStudioEventLine(
  line: string,
  index: number,
  error: unknown
): InvalidStudioEventLine {
  return {
    lineNumber: index + 1,
    eventType: readEventType(line),
    reason: error instanceof Error ? error.message : 'Invalid Studio event.',
  };
}

function summarizeInvalidEventLines(
  invalidLines: InvalidStudioEventLine[]
): StudioEventReadResult['warnings'] {
  if (invalidLines.length === 0) {
    return [];
  }
  const samples = invalidLines.slice(0, 3).map(formatInvalidLineSample).join('; ');
  return [
    studioCoordinationWarning(
      'STUDIO_COORDINATION007',
      `Skipped ${invalidLines.length} invalid historical Studio coordination event line${invalidLines.length === 1 ? '' : 's'}.`,
      ['events'],
      `Sample invalid lines: ${samples}. Continue with later valid events and inspect the local event store if this repeats.`
    ),
  ];
}

function formatInvalidLineSample(line: InvalidStudioEventLine): string {
  const eventType = line.eventType ? ` ${line.eventType}` : '';
  return `${line.lineNumber}${eventType} (${line.reason})`;
}

function readEventType(line: string): string | undefined {
  try {
    const value = JSON.parse(line) as { type?: unknown };
    return typeof value.type === 'string' ? value.type : undefined;
  } catch {
    return undefined;
  }
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
