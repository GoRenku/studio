import os from 'node:os';
import path from 'node:path';
import {
  STUDIO_DEV_SERVER_HOST,
  STUDIO_DEV_SERVER_PORT,
  STUDIO_DEV_SERVER_URL,
  createProjectDataService,
  createStudioCoordinationService,
  isStudioRuntimeDescriptorUsable,
  readStudioEventStoreSummary,
  readStudioRuntimeDescriptor,
} from '@gorenku/studio-core/server';
import {
  StructuredError,
  createDiagnosticError,
} from '@gorenku/studio-diagnostics';
import type {
  StudioCurrent,
  StudioRuntimeDescriptor,
} from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../cli.js';
import {
  appendStudioResourceChangedEvent,
} from './studio-resource-event-command.js';

interface StudioCommandOptions {
  input: string[];
  project?: string;
  resource?: string[];
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}

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
    serverPolicy: 'attachOnly';
    browserUrl: typeof STUDIO_DEV_SERVER_URL;
    browserAccess: {
      requiredSurface: 'inAppBrowser';
      accessMethod: 'browserClientBootstrap';
      requiredTool: 'mcp__node_repl__js';
      directBrowserToolRequired: false;
    };
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

export async function runStudioCommand(
  options: StudioCommandOptions
): Promise<number> {
  if (options.input[0] === 'current') {
    return await runStudioCurrentCommand(options);
  }
  if (options.input[0] === 'server' && options.input[1] === 'status') {
    return await runStudioServerStatusCommand(options);
  }
  if (options.input[0] === 'notify-refresh') {
    return await runStudioNotifyRefreshCommand(options);
  }

  options.io.stderr.error(
    'Usage: renku studio current --json OR renku studio server status --json OR renku studio notify-refresh --project <project-name> --resource <resource-key> --json'
  );
  return 1;
}

async function runStudioCurrentCommand(
  options: StudioCommandOptions
): Promise<number> {
  if (options.input.length !== 1) {
    options.io.stderr.error('Usage: renku studio current --json');
    return 1;
  }
  const current = await createStudioCoordinationService({
    homeDir: options.homeDir,
  }).readStudioCurrent();
  if (options.json) {
    options.io.stdout.log(JSON.stringify(current, null, 2));
  } else {
    writeCurrentStudioSummary(options.io, current);
  }
  return 0;
}

async function runStudioNotifyRefreshCommand(
  options: StudioCommandOptions
): Promise<number> {
  if (options.input.length !== 1) {
    options.io.stderr.error(
      'Usage: renku studio notify-refresh --project <project-name> --resource <resource-key> --json'
    );
    return 1;
  }
  const project = requiredStudioFlag(options.project, '--project');
  const resourceKeys = (options.resource ?? []).map((resource) => resource.trim()).filter(Boolean);
  if (resourceKeys.length === 0) {
    throw missingStudioFlag('--resource');
  }
  await appendStudioResourceChangedEvent({
    runtime: {
      projectName: project,
      homeDir: options.homeDir,
      json: options.json,
      io: options.io,
      projectDataService: createProjectDataService(),
    },
    report: {
      project: { name: project },
      resourceKeys,
    },
    command: 'studio notify-refresh',
  });
  const report = {
    valid: true,
    project: { name: project },
    resourceKeys,
  };
  if (options.json) {
    options.io.stdout.log(JSON.stringify(report, null, 2));
  } else {
    options.io.stdout.log(`Requested Studio refresh for ${resourceKeys.length} resource(s).`);
  }
  return 0;
}

async function runStudioServerStatusCommand(
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
  const descriptor = await readStudioRuntimeDescriptor({
    homeDir: input.homeDir,
  });
  const descriptorStatus = describeRuntimeDescriptor(descriptor, input.now);
  const eventStore = await readStudioEventStoreSummary({
    homeDir: input.homeDir,
  });

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
      serverPolicy: 'attachOnly',
      browserUrl: STUDIO_DEV_SERVER_URL,
      browserAccess: {
        requiredSurface: 'inAppBrowser',
        accessMethod: 'browserClientBootstrap',
        requiredTool: 'mcp__node_repl__js',
        directBrowserToolRequired: false,
      },
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

function descriptorMatchesCanonicalServer(
  descriptor: StudioRuntimeDescriptor
): boolean {
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
  if (Number.isNaN(heartbeatTime)) {
    return null;
  }
  return Math.max(0, now.getTime() - heartbeatTime);
}

function writeStudioServerStatusSummary(
  io: RenkuCliIo,
  status: StudioServerStatus
): void {
  const descriptor = status.server.descriptor;
  if (!descriptor.present) {
    io.stdout.log('Studio dev server descriptor: missing.');
    io.stdout.log(`Canonical URL: ${status.server.canonicalUrl}`);
    io.stdout.log(
      'Browser access: use the in-app Browser through the browser-client bootstrap.'
    );
    return;
  }

  io.stdout.log(
    `Studio dev server: ${descriptor.fresh ? 'running' : 'stale'} at ${descriptor.serverUrl}`
  );
  if (!descriptor.matchesCanonical) {
    io.stdout.log(
      `Expected canonical dev server: ${status.server.canonicalUrl}`
    );
  }
  io.stdout.log(
    `Event store: ${status.eventStore.lineCount} lines, ${status.eventStore.invalidEventCount} invalid historical events.`
  );
  io.stdout.log(
    'Browser access: use the in-app Browser through the browser-client bootstrap.'
  );
}

function writeCurrentStudioSummary(
  io: RenkuCliIo,
  current: StudioCurrent
): void {
  if (!current.project) {
    io.stdout.log('No active Studio selection is available.');
    return;
  }
  io.stdout.log(`Current Studio project: ${current.project.name}`);
  const focus = focusSummary(current);
  if (focus) {
    io.stdout.log(`Focus: ${focus}`);
  }
}

function requiredStudioFlag(value: string | undefined, name: string): string {
  if (!value?.trim()) {
    throw missingStudioFlag(name);
  }
  return value.trim();
}

function missingStudioFlag(flag: string): StructuredError {
  return new StructuredError({
    code: 'CLI143',
    message: `Missing required flag: ${flag}.`,
    issues: [
      createDiagnosticError(
        'CLI143',
        `Missing required flag: ${flag}.`,
        { path: ['studio', 'notify-refresh', flag], context: 'renku CLI arguments' },
        'Run renku studio notify-refresh --project <project-name> --resource <resource-key> --json.'
      ),
    ],
  });
}

function focusSummary(current: StudioCurrent): string | null {
  const context = current.context;
  if (!context) {
    return null;
  }
  if (context.kind === 'scene') {
    return [
      `Scene ${context.title}`,
      context.sceneTab.label,
      context.shot?.label,
      context.shot?.activeTab.label,
    ]
      .filter(Boolean)
      .join(' > ');
  }
  switch (context.kind) {
    case 'projectInformation':
      return 'Project Details';
    case 'visualLanguage':
      return 'Visual Language';
    case 'cast':
      return 'Cast';
    case 'castMember':
      return `Cast ${context.name}`;
    case 'locations':
      return 'Locations';
    case 'location':
      return `Location ${context.name}`;
    case 'storyArc':
      return 'Story Arc';
    case 'sequence':
      return `Sequence ${context.title}`;
  }
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
