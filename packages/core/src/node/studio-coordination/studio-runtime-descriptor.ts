import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveRenkuConfigDir, type RenkuConfigPathOptions } from '../config.js';
import { StudioCoordinationError } from './studio-coordination-errors.js';

export const STUDIO_RUNTIME_DESCRIPTOR_FILE_NAME = 'studio-runtime.json' as const;
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
}

export interface ClaimStudioRuntimeDescriptorInput extends RenkuConfigPathOptions {
  host: string;
  port: number;
  serverUrl: string;
  now?: Date;
}

export function createStudioServerInstanceId(): string {
  return `studio_server_${crypto.randomUUID()}`;
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
  if (existing && !isStudioRuntimeDescriptorStale(existing, now)) {
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
  };
  await fs.mkdir(path.dirname(descriptorPath), { recursive: true });
  await fs.writeFile(descriptorPath, JSON.stringify(descriptor, null, 2), 'utf8');
  return descriptor;
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
  await fs.writeFile(
    resolveStudioRuntimeDescriptorPath(options),
    JSON.stringify(next, null, 2),
    'utf8'
  );
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

interface NodeError extends Error {
  code?: string;
}

function isNodeError(error: unknown): error is NodeError {
  return error instanceof Error && 'code' in error;
}
