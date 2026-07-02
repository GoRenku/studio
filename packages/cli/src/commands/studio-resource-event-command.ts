import {
  createStudioOperationId,
  createStudioCoordinationService,
  resolveRenkuStorageRoot,
  type StudioProjectRef,
  type StudioSelection,
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
  operationId?: string;
}): Promise<void> {
  if (input.report.resourceKeys.length === 0) {
    return;
  }

  const operationId = input.operationId ?? createStudioOperationId();
  const result = await notifyStudioProjectResourcesChanged({
    homeDir: input.runtime.homeDir,
    notification: {
      projectRef: await toProjectRef(input.report.project, input.runtime.homeDir),
      resourceKeys: input.report.resourceKeys,
      source: { kind: 'cli', command: input.command },
      operationId,
    },
  });

  if (result.status === 'deliveryFailed') {
    writeStudioResourceChangedWarning(input.runtime, result);
  }
}

export async function appendStudioFocusRequestedEvent(input: {
  runtime: CliCommandRuntime;
  project: StudioResourceChangedReport['project'];
  selection: StudioSelection;
  command: string;
  operationId?: string;
}): Promise<void> {
  await createStudioCoordinationService({
    homeDir: input.runtime.homeDir,
  }).appendStudioEvent({
    type: 'studio.focusRequested',
    projectRef: await toProjectRef(input.project, input.runtime.homeDir),
    focus: {
      screen: 'movieStudio',
      selection: input.selection,
    },
    source: { kind: 'cli', command: input.command },
    operationId: input.operationId ?? createStudioOperationId(),
  });
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
  const suggestion =
    'If this command ran in Codex or another sandbox, run future Renku mutations with local network access so the localhost Studio notification can be delivered. Do not rerun non-idempotent mutations only to refresh Studio; read back state and refresh Studio manually if needed.';
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
              suggestion,
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
    `[CLI026] WARNING Project mutation succeeded, but the running Studio app could not be notified: ${detail}\nSuggestion: ${suggestion}`
  );
}
