import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveRenkuConfigDir, type RenkuConfigPathOptions } from '../config/index.js';
import { telemetryFileInvalidError, telemetryFileIoError } from './errors.js';

const TELEMETRY_FILE_NAME = 'telemetry.json' as const;
const TELEMETRY_FORMAT_VERSION = 1 as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function resolveTelemetryFilePath(options: RenkuConfigPathOptions = {}): string {
  return path.join(resolveRenkuConfigDir(options), TELEMETRY_FILE_NAME);
}

/** The saved install ID, or null when usage statistics are off (no file). */
export async function readTelemetryInstallId(options: RenkuConfigPathOptions = {}): Promise<string | null> {
  const filePath = resolveTelemetryFilePath(options);
  let contents: string;
  try {
    contents = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }
    throw telemetryFileIoError('read', filePath);
  }
  return parseInstallId(contents, filePath);
}

/** Writes the file atomically: a temporary file, then a rename over the target. */
export async function writeTelemetryInstallId(
  installId: string,
  options: RenkuConfigPathOptions = {}
): Promise<void> {
  const filePath = resolveTelemetryFilePath(options);
  const directory = path.dirname(filePath);
  const temporaryPath = path.join(directory, `.${TELEMETRY_FILE_NAME}.${process.pid}.${Date.now()}.tmp`);
  let temporaryCreated = false;
  try {
    await fs.mkdir(directory, { recursive: true });
    const handle = await fs.open(temporaryPath, 'wx', 0o600);
    temporaryCreated = true;
    try {
      await handle.writeFile(`${JSON.stringify({ formatVersion: TELEMETRY_FORMAT_VERSION, installId }, null, 2)}\n`, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(temporaryPath, filePath);
    temporaryCreated = false;
  } catch {
    if (temporaryCreated) {
      await fs.unlink(temporaryPath).catch(() => undefined);
    }
    throw telemetryFileIoError('write', filePath);
  }
}

export async function deleteTelemetryChoiceFile(options: RenkuConfigPathOptions = {}): Promise<void> {
  const filePath = resolveTelemetryFilePath(options);
  try {
    await fs.rm(filePath, { force: true });
  } catch {
    throw telemetryFileIoError('delete', filePath);
  }
}

function parseInstallId(contents: string, filePath: string): string {
  let document: unknown;
  try {
    document = JSON.parse(contents);
  } catch {
    throw telemetryFileInvalidError(filePath);
  }
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw telemetryFileInvalidError(filePath);
  }
  const fields = document as Record<string, unknown>;
  const keys = Object.keys(fields).sort();
  if (keys.length !== 2 || keys[0] !== 'formatVersion' || keys[1] !== 'installId' ||
      fields.formatVersion !== TELEMETRY_FORMAT_VERSION ||
      typeof fields.installId !== 'string' || !UUID_PATTERN.test(fields.installId)) {
    throw telemetryFileInvalidError(filePath);
  }
  return fields.installId;
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
