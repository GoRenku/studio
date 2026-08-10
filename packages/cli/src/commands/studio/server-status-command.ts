import os from 'node:os';
import path from 'node:path';
import {
  STUDIO_DEV_SERVER_HOST,
  STUDIO_DEV_SERVER_PORT,
  STUDIO_DEV_SERVER_URL,
  isStudioRuntimeDescriptorUsable,
  readStudioEventStoreSummary,
  readStudioRuntimeDescriptor,
  type StudioRuntimeDescriptor,
} from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../../cli.js';
import type { StudioCommandOptions } from './contracts.js';

interface StudioServerStatus {
  server: {
    running: boolean;
    canonicalUrl: typeof STUDIO_DEV_SERVER_URL;
    descriptor: StudioServerDescriptorStatus;
  };
  eventStore: {
    path: string;
    lineCount: number;
    invalidEventCount: number;
    warningCount: number;
  };
  agent: {
    serverPolicy: 'foreground';
    browserUrl: typeof STUDIO_DEV_SERVER_URL;
  };
}

type StudioServerDescriptorStatus =
  | {
      present: false;
      fresh: false;
      host: null;
      port: null;
      serverUrl: null;
      pid: null;
      heartbeatAgeMs: null;
      hasCliNotificationToken: false;
      matchesCanonical: false;
    }
  | {
      present: true;
      fresh: boolean;
      host: string;
      port: number;
      serverUrl: string;
      pid: number;
      heartbeatAgeMs: number | null;
      hasCliNotificationToken: boolean;
      matchesCanonical: boolean;
    };

export async function runStudioServerStatusCommand(
  options: StudioCommandOptions
): Promise<number> {
  if (options.input.length !== 2) {
    options.io.stderr.error('Usage: renku studio server status --json');
    return 1;
  }
  const status = await readStudioServerStatus({
    homeDir: options.homeDir,
    now: new Date(),
  });
  if (options.json) {
    options.io.stdout.log(JSON.stringify(status, null, 2));
  } else {
    writeStudioServerStatusSummary(options.io, status);
  }
  return 0;
}

async function readStudioServerStatus(input: {
  homeDir?: string;
  now: Date;
}): Promise<StudioServerStatus> {
  const descriptor = await readStudioRuntimeDescriptor({ homeDir: input.homeDir });
  const descriptorStatus = describeRuntimeDescriptor(descriptor, input.now);
  const eventStore = await readStudioEventStoreSummary({ homeDir: input.homeDir });
  return {
    server: {
      running: descriptorStatus.present && descriptorStatus.fresh,
      canonicalUrl: STUDIO_DEV_SERVER_URL,
      descriptor: descriptorStatus,
    },
    eventStore: {
      path: formatHomeRelativePath(eventStore.path, input.homeDir),
      lineCount: eventStore.lineCount,
      invalidEventCount: eventStore.invalidEventCount,
      warningCount: eventStore.warningCount,
    },
    agent: {
      serverPolicy: 'foreground',
      browserUrl: STUDIO_DEV_SERVER_URL,
    },
  };
}

function describeRuntimeDescriptor(
  descriptor: StudioRuntimeDescriptor | null,
  now: Date
): StudioServerDescriptorStatus {
  if (!descriptor) {
    return {
      present: false,
      fresh: false,
      host: null,
      port: null,
      serverUrl: null,
      pid: null,
      heartbeatAgeMs: null,
      hasCliNotificationToken: false,
      matchesCanonical: false,
    };
  }
  return {
    present: true,
    fresh: isStudioRuntimeDescriptorUsable(descriptor, now),
    host: descriptor.host,
    port: descriptor.port,
    serverUrl: descriptor.serverUrl,
    pid: descriptor.pid,
    heartbeatAgeMs: heartbeatAgeMs(descriptor, now),
    hasCliNotificationToken: Boolean(descriptor.cliNotificationToken),
    matchesCanonical: descriptorMatchesCanonicalServer(descriptor),
  };
}

function descriptorMatchesCanonicalServer(descriptor: StudioRuntimeDescriptor): boolean {
  return (
    descriptor.host === STUDIO_DEV_SERVER_HOST &&
    descriptor.port === STUDIO_DEV_SERVER_PORT &&
    descriptor.serverUrl === STUDIO_DEV_SERVER_URL
  );
}

function heartbeatAgeMs(
  descriptor: StudioRuntimeDescriptor,
  now: Date
): number | null {
  const heartbeatTime = Date.parse(descriptor.heartbeatAt);
  return Number.isNaN(heartbeatTime)
    ? null
    : Math.max(0, now.getTime() - heartbeatTime);
}

function writeStudioServerStatusSummary(
  io: RenkuCliIo,
  status: StudioServerStatus
): void {
  const descriptor = status.server.descriptor;
  if (!descriptor.present) {
    io.stdout.log('Studio server descriptor: missing.');
    io.stdout.log(`Canonical URL: ${status.server.canonicalUrl}`);
    io.stdout.log('Start Studio with renku studio start.');
    return;
  }
  io.stdout.log(
    `Studio server: ${descriptor.fresh ? 'running' : 'stale'} at ${descriptor.serverUrl}`
  );
  if (!descriptor.matchesCanonical) {
    io.stdout.log(`Expected canonical server: ${status.server.canonicalUrl}`);
  }
  io.stdout.log(
    `Event store: ${status.eventStore.lineCount} lines, ${status.eventStore.invalidEventCount} invalid historical events.`
  );
}

function formatHomeRelativePath(filePath: string, homeDir?: string): string {
  const effectiveHomeDir = path.resolve(homeDir ?? os.homedir());
  const resolvedPath = path.resolve(filePath);
  const relativePath = path.relative(effectiveHomeDir, resolvedPath);
  if (
    relativePath &&
    !relativePath.startsWith('..') &&
    !path.isAbsolute(relativePath)
  ) {
    return path.join('~', relativePath).split(path.sep).join('/');
  }
  return filePath;
}
