import {
  createStudioOperationId,
  resolveRenkuStorageRoot,
  type StudioProjectRef,
} from '@gorenku/studio-core/server';
import { notifyStudioProjectResourcesChanged } from './studio-notification-client.js';
import type { CliCommandRuntime } from './structured-command.js';

export interface StudioResourceChangedReport {
  project: {
    name: string;
    id?: string;
  };
  resourceKeys: string[];
}

export async function appendStudioResourceChangedEvent(input: {
  runtime: CliCommandRuntime;
  report: StudioResourceChangedReport;
  command: string;
}): Promise<void> {
  if (input.report.resourceKeys.length === 0) {
    return;
  }

  const result = await notifyStudioProjectResourcesChanged({
    homeDir: input.runtime.homeDir,
    notification: {
      projectRef: await toProjectRef(input.report.project, input.runtime.homeDir),
      resourceKeys: input.report.resourceKeys,
      source: { kind: 'cli', command: input.command },
      operationId: createStudioOperationId(),
    },
  });

  if (result.status === 'deliveryFailed') {
    writeStudioResourceChangedWarning(input.runtime, result);
  }
}

async function toProjectRef(
  project: StudioResourceChangedReport['project'],
  homeDir?: string
): Promise<StudioProjectRef> {
  return {
    name: project.name,
    id: project.id ?? project.name,
    storageRoot: await resolveRenkuStorageRoot({ homeDir }),
  };
}

function writeStudioResourceChangedWarning(
  runtime: CliCommandRuntime,
  failure: { serverUrl: string; detail: string }
): void {
  const detail = `${failure.serverUrl}: ${failure.detail}`;
  if (runtime.json) {
    runtime.io.stderr.error(
      JSON.stringify(
        {
          warnings: [
            {
              code: 'CLI026',
              message:
                'Project mutation succeeded, but the running Studio app could not be notified.',
              detail,
            },
          ],
        },
        null,
        2
      )
    );
    return;
  }
  runtime.io.stderr.error(
    `[CLI026] WARNING Project mutation succeeded, but the running Studio app could not be notified: ${detail}`
  );
}
