import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMovieStudioServer } from '@gorenku/studio/server';
import {
  StructuredError,
  createDiagnosticError,
  createDiagnosticWarning,
} from '@gorenku/studio-diagnostics';
import {
  STUDIO_DEV_SERVER_HOST,
  STUDIO_DEV_SERVER_PORT,
  STUDIO_DEV_SERVER_URL,
  isStudioRuntimeDescriptorUsable,
  readStudioRuntimeDescriptor,
} from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../../cli.js';
import { openStudioBrowser } from './browser-launch.js';

interface StudioStartCommandOptions {
  input: string[];
  noBrowser: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}

export async function runStudioStartCommand(
  options: StudioStartCommandOptions
): Promise<number> {
  if (options.input.length !== 1) {
    options.io.stderr.error('Usage: renku studio start [--no-browser]');
    return 1;
  }

  const existing = await readStudioRuntimeDescriptor({ homeDir: options.homeDir });
  if (existing && isStudioRuntimeDescriptorUsable(existing)) {
    options.io.stdout.log(`Renku Studio is already running at ${existing.serverUrl}`);
    if (!options.noBrowser) {
      await openBrowserWithWarning(existing.serverUrl, options.io);
    }
    return 0;
  }

  const layout = resolveStudioProductLayout();
  let server: Awaited<ReturnType<typeof startMovieStudioServer>>;
  try {
    server = await startMovieStudioServer({
      distPath: layout.webAssets,
      host: STUDIO_DEV_SERVER_HOST,
      port: STUDIO_DEV_SERVER_PORT,
      log: (message) => options.io.stdout.log(message),
    });
  } catch (error) {
    if (isAddressInUseError(error)) {
      throw occupiedStudioPortError();
    }
    throw error;
  }
  if (!options.noBrowser) {
    await openBrowserWithWarning(server.url, options.io);
  }
  await waitForShutdownSignal();
  await server.stop();
  return 0;
}

function resolveStudioProductLayout(): {
  webAssets: string;
} {
  let studioServerIndex: string;
  try {
    studioServerIndex = fileURLToPath(import.meta.resolve('@gorenku/studio/server'));
  } catch (error) {
    throw incompleteStudioRuntimeError([
      `@gorenku/studio/server (${error instanceof Error ? error.message : String(error)})`,
    ]);
  }
  const packageRoot = path.dirname(path.dirname(studioServerIndex));
  const webAssets = path.join(packageRoot, 'dist');
  const missing = [webAssets].filter((candidate) => !existsSync(candidate));
  if (missing.length > 0) {
    throw incompleteStudioRuntimeError(missing);
  }
  return { webAssets };
}

function incompleteStudioRuntimeError(missing: string[]): StructuredError {
  return new StructuredError({
    code: 'CLI161',
    message: 'The Renku Studio runtime is incomplete.',
    issues: missing.map((candidate) =>
      createDiagnosticError(
        'CLI161',
        `Required Studio runtime path is missing: ${candidate}.`,
        { path: ['studio', 'start'], context: 'installed Renku product' },
        'Re-run the Renku installer and retry renku studio start.'
      )
    ),
  });
}

async function openBrowserWithWarning(url: string, io: RenkuCliIo): Promise<void> {
  if (await openStudioBrowser(url)) {
    return;
  }
  const warning = createDiagnosticWarning(
    'CLI163',
    `Renku Studio is running, but the browser could not be opened. Open ${url} manually.`,
    { path: ['studio', 'start'], context: 'system browser launch' }
  );
  io.stderr.error(`[${warning.code}] WARNING: ${warning.message}`);
}

function waitForShutdownSignal(): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      process.off('SIGINT', finish);
      process.off('SIGTERM', finish);
      resolve();
    };
    process.on('SIGINT', finish);
    process.on('SIGTERM', finish);
  });
}

function isAddressInUseError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'EADDRINUSE';
}

function occupiedStudioPortError(): StructuredError {
  return new StructuredError({
    code: 'CLI162',
    message: `Port ${STUDIO_DEV_SERVER_PORT} is already in use by another process.`,
    issues: [
      createDiagnosticError(
        'CLI162',
        `Renku Studio could not bind ${STUDIO_DEV_SERVER_URL}.`,
        { path: ['studio', 'start'], context: 'local Studio server' },
        `Stop the process using port ${STUDIO_DEV_SERVER_PORT}, then retry.`
      ),
    ],
  });
}
