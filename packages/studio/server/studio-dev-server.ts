import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STUDIO_DEV_SERVER_HOST,
  STUDIO_DEV_SERVER_PORT,
  STUDIO_DEV_SERVER_URL,
  type ClaimStudioRuntimeDescriptorInput,
  type StudioRuntimeDescriptor,
} from '@gorenku/studio-core/server';

const studioServerSourceDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(studioServerSourceDir, '..', '..', '..');

export const STUDIO_DEV_SERVER_LOG_PATH = path.join(
  workspaceRoot,
  'tmp',
  'studio-dev-server.log'
);

export type ClaimStudioRuntimeDescriptor = (
  input: ClaimStudioRuntimeDescriptorInput
) => Promise<StudioRuntimeDescriptor>;

export interface ClaimRequiredStudioDevRuntimeInput {
  port: number;
  cliNotificationToken: string;
  claimRuntimeDescriptor: ClaimStudioRuntimeDescriptor;
  closeServer: () => Promise<void>;
  logPath?: string;
}

export async function claimRequiredStudioDevRuntime(
  input: ClaimRequiredStudioDevRuntimeInput
): Promise<StudioRuntimeDescriptor> {
  try {
    assertCanonicalDevPort(input.port);
    const descriptor = await input.claimRuntimeDescriptor({
      host: STUDIO_DEV_SERVER_HOST,
      port: STUDIO_DEV_SERVER_PORT,
      serverUrl: STUDIO_DEV_SERVER_URL,
      cliNotificationToken: input.cliNotificationToken,
      replaceNonCanonicalDevServer: true,
    });
    await appendStudioDevServerLog(
      `claimed runtime descriptor pid=${descriptor.pid} url=${descriptor.serverUrl}`,
      { logPath: input.logPath }
    );
    return descriptor;
  } catch (error) {
    await appendStudioDevServerLog(
      `failed to claim runtime descriptor: ${formatDevServerError(error)}`,
      { logPath: input.logPath }
    );
    await input.closeServer();
    throw error;
  }
}

export async function appendStudioDevServerLog(
  message: string,
  options: { logPath?: string } = {}
): Promise<void> {
  const logPath = options.logPath ?? STUDIO_DEV_SERVER_LOG_PATH;
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  await fs.appendFile(logPath, `[${new Date().toISOString()}] ${message}\n`, 'utf8');
}

function assertCanonicalDevPort(port: number): void {
  if (port !== STUDIO_DEV_SERVER_PORT) {
    throw new Error(
      `Renku Studio dev server must listen on ${STUDIO_DEV_SERVER_URL}; received port ${port}.`
    );
  }
}

function formatDevServerError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
