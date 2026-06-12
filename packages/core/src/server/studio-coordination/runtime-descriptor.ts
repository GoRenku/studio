import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveRenkuConfigDir, type RenkuConfigPathOptions } from '../renku-config.js';
import { StudioCoordinationError } from './errors.js';

export const STUDIO_RUNTIME_DESCRIPTOR_FILE_NAME = 'studio-runtime.json' as const;
export const STUDIO_DEV_SERVER_HOST = 'localhost' as const;
export const STUDIO_DEV_SERVER_PORT = 5173 as const;
export const STUDIO_DEV_SERVER_URL =
  `http://${STUDIO_DEV_SERVER_HOST}:${STUDIO_DEV_SERVER_PORT}` as const;
export const STUDIO_RUNTIME_HEARTBEAT_INTERVAL_MS = 30_000;
export const STUDIO_RUNTIME_STALE_AFTER_MS = 90_000;

export interface StudioRuntimeDescriptor {
  version: '0.1.0';
  serverInstanceId: string;
  pid: number;
  host: string;
  port: number;
  serverUrl: string;
  startedAt: string;
  heartbeatAt: string;
  cliNotificationToken?: string;
}

export interface ClaimStudioRuntimeDescriptorInput extends RenkuConfigPathOptions {
  host: string;
  port: number;
  serverUrl: string;
  cliNotificationToken?: string;
  now?: Date;
  replaceNonCanonicalDevServer?: boolean;
}

export function createStudioServerInstanceId(): string {
  return `studio_server_${crypto.randomUUID()}`;
}

export function createStudioCliNotificationToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function resolveStudioRuntimeDescriptorPath(
  options: RenkuConfigPathOptions = {}
): string {
  return path.join(resolveRenkuConfigDir(options), STUDIO_RUNTIME_DESCRIPTOR_FILE_NAME);
}

export async function readStudioRuntimeDescriptor(
  options: RenkuConfigPathOptions = {}
): Promise<StudioRuntimeDescriptor | null> {
  try {
    const contents = await fs.readFile(resolveStudioRuntimeDescriptorPath(options), 'utf8');
    const parsed = JSON.parse(contents) as StudioRuntimeDescriptor;
    if (parsed.version !== '0.1.0' || typeof parsed.serverInstanceId !== 'string') {
      return null;
    }
    return parsed;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return null;
    }
    return null;
  }
}

export async function claimStudioRuntimeDescriptor(
  input: ClaimStudioRuntimeDescriptorInput
): Promise<StudioRuntimeDescriptor> {
  const descriptorPath = resolveStudioRuntimeDescriptorPath(input);
  const existing = await readStudioRuntimeDescriptor(input);
  const now = input.now ?? new Date();
  if (
    existing &&
    isStudioRuntimeDescriptorUsable(existing, now) &&
    !canReplaceExistingDevDescriptor(existing, input)
  ) {
    throw new StudioCoordinationError(
      'STUDIO_COORDINATION030',
      `Renku Studio is already running at ${existing.serverUrl}.`,
      {
        suggestion: 'Use the existing Studio server or stop it before starting a new one.',
      }
    );
  }

  const descriptor: StudioRuntimeDescriptor = {
    version: '0.1.0',
    serverInstanceId: createStudioServerInstanceId(),
    pid: process.pid,
    host: input.host,
    port: input.port,
    serverUrl: input.serverUrl,
    startedAt: now.toISOString(),
    heartbeatAt: now.toISOString(),
    cliNotificationToken:
      input.cliNotificationToken ?? createStudioCliNotificationToken(),
  };
  await fs.mkdir(path.dirname(descriptorPath), { recursive: true });
  await writeStudioRuntimeDescriptor(descriptorPath, descriptor);
  return descriptor;
}

function canReplaceExistingDevDescriptor(
  existing: StudioRuntimeDescriptor,
  input: ClaimStudioRuntimeDescriptorInput
): boolean {
  return (
    input.replaceNonCanonicalDevServer === true &&
    isCanonicalDevDescriptorInput(input) &&
    !isCanonicalDevDescriptor(existing)
  );
}

function isCanonicalDevDescriptorInput(
  input: ClaimStudioRuntimeDescriptorInput
): boolean {
  return (
    input.host === STUDIO_DEV_SERVER_HOST &&
    input.port === STUDIO_DEV_SERVER_PORT &&
    input.serverUrl === STUDIO_DEV_SERVER_URL
  );
}

function isCanonicalDevDescriptor(
  descriptor: StudioRuntimeDescriptor
): boolean {
  return (
    descriptor.host === STUDIO_DEV_SERVER_HOST &&
    descriptor.port === STUDIO_DEV_SERVER_PORT &&
    descriptor.serverUrl === STUDIO_DEV_SERVER_URL
  );
}

export async function heartbeatStudioRuntimeDescriptor(
  descriptor: StudioRuntimeDescriptor,
  options: RenkuConfigPathOptions = {}
): Promise<StudioRuntimeDescriptor> {
  const current = await readStudioRuntimeDescriptor(options);
  if (current?.serverInstanceId !== descriptor.serverInstanceId) {
    return descriptor;
  }
  const next = { ...descriptor, heartbeatAt: new Date().toISOString() };
  await writeStudioRuntimeDescriptor(resolveStudioRuntimeDescriptorPath(options), next);
  return next;
}

export async function releaseStudioRuntimeDescriptor(
  descriptor: StudioRuntimeDescriptor,
  options: RenkuConfigPathOptions = {}
): Promise<void> {
  const current = await readStudioRuntimeDescriptor(options);
  if (current?.serverInstanceId === descriptor.serverInstanceId) {
    await fs.unlink(resolveStudioRuntimeDescriptorPath(options));
  }
}

export function isStudioRuntimeDescriptorStale(
  descriptor: StudioRuntimeDescriptor,
  now = new Date()
): boolean {
  return now.getTime() - Date.parse(descriptor.heartbeatAt) > STUDIO_RUNTIME_STALE_AFTER_MS;
}

export function isStudioRuntimeDescriptorUsable(
  descriptor: StudioRuntimeDescriptor,
  now = new Date()
): boolean {
  return (
    !isStudioRuntimeDescriptorStale(descriptor, now) &&
    isStudioRuntimeDescriptorProcessAlive(descriptor)
  );
}

export function isStudioRuntimeDescriptorProcessAlive(
  descriptor: StudioRuntimeDescriptor
): boolean {
  if (!Number.isInteger(descriptor.pid) || descriptor.pid <= 0) {
    return false;
  }
  try {
    process.kill(descriptor.pid, 0);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ESRCH') {
      return false;
    }
    return true;
  }
}

async function writeStudioRuntimeDescriptor(
  descriptorPath: string,
  descriptor: StudioRuntimeDescriptor
): Promise<void> {
  const descriptorMode = descriptor.cliNotificationToken ? 0o600 : 0o644;
  const temporaryDescriptorPath = `${descriptorPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryDescriptorPath, JSON.stringify(descriptor, null, 2), {
      encoding: 'utf8',
      mode: descriptorMode,
    });
    await fs.chmod(temporaryDescriptorPath, descriptorMode);
    await fs.rename(temporaryDescriptorPath, descriptorPath);
  } catch (error) {
    await fs.unlink(temporaryDescriptorPath).catch(() => undefined);
    throw error;
  }
}

interface NodeError extends Error {
  code?: string;
}

function isNodeError(error: unknown): error is NodeError {
  return error instanceof Error && 'code' in error;
}
