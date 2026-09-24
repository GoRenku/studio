import { setTimeout as delay } from 'node:timers/promises';
import {
  isStudioRuntimeDescriptorProcessAlive,
  isStudioRuntimeDescriptorUsable,
  readStudioRuntimeDescriptor,
  type StudioRuntimeDescriptor,
} from '@gorenku/studio-core/server';
import { StructuredError, createDiagnosticError } from '@gorenku/studio-diagnostics';
import type { StudioCommandOptions } from './contracts.js';

const SHUTDOWN_REQUEST_TIMEOUT_MS = 2_000;
const SHUTDOWN_WAIT_MS = 5_000;

export async function runStudioStopCommand(options: StudioCommandOptions): Promise<number> {
  if (options.input.length !== 1) {
    options.io.stderr.error('Usage: renku studio stop');
    return 1;
  }

  const descriptor = await readStudioRuntimeDescriptor({ homeDir: options.homeDir });
  if (!descriptor || !isStudioRuntimeDescriptorProcessAlive(descriptor)) {
    writeStopResult(options, false);
    return 0;
  }
  if (!isStudioRuntimeDescriptorUsable(descriptor)) {
    throw stopError(
      'CLI164',
      'The Studio runtime descriptor is stale.',
      'Stop Studio in the terminal that started it, then retry.'
    );
  }
  const endpoint = shutdownEndpoint(descriptor);
  if (!descriptor.cliNotificationToken || !endpoint) {
    throw stopError(
      'CLI164',
      'The Studio runtime descriptor cannot authorize a local shutdown.',
      'Stop Studio in the terminal that started it.'
    );
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      signal: AbortSignal.timeout(SHUTDOWN_REQUEST_TIMEOUT_MS),
      headers: { 'X-Renku-Studio-Notification-Token': descriptor.cliNotificationToken },
    });
  } catch (error) {
    throw stopError(
      'CLI165',
      'Studio did not accept the shutdown request.',
      error instanceof Error ? error.message : 'Check that Studio is responding, then retry.'
    );
  }
  if (!response.ok) {
    throw stopError(
      'CLI165',
      `Studio rejected the shutdown request (HTTP ${response.status}).`,
      'Check the Studio server status and retry.'
    );
  }

  const deadline = Date.now() + SHUTDOWN_WAIT_MS;
  while (Date.now() < deadline) {
    const current = await readStudioRuntimeDescriptor({ homeDir: options.homeDir });
    if (!current || current.serverInstanceId !== descriptor.serverInstanceId) {
      writeStopResult(options, true);
      return 0;
    }
    await delay(100);
  }
  throw stopError(
    'CLI166',
    'Studio accepted the shutdown request but did not stop in time.',
    'Check renku studio server status and the terminal running Studio.'
  );
}

function shutdownEndpoint(descriptor: StudioRuntimeDescriptor): URL | null {
  try {
    const url = new URL(descriptor.serverUrl);
    if (
      url.protocol !== 'http:' ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      (url.hostname !== descriptor.host && url.hostname !== `[${descriptor.host}]`) ||
      Number(url.port) !== descriptor.port ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return new URL('/studio-api/studio/shutdown', url);
  } catch {
    return null;
  }
}

function writeStopResult(options: StudioCommandOptions, stopped: boolean): void {
  if (options.json) {
    options.io.stdout.log(JSON.stringify({ stopped }));
  } else {
    options.io.stdout.log(stopped ? 'Renku Studio stopped.' : 'Renku Studio is not running.');
  }
}

function stopError(code: string, message: string, suggestion: string): StructuredError {
  return new StructuredError({
    code,
    message,
    issues: [
      createDiagnosticError(
        code,
        message,
        { path: ['studio', 'stop'], context: 'local Studio server' },
        suggestion
      ),
    ],
  });
}
