import {
  createStudioCoordinationService,
  createStudioOperationId,
  resolveRenkuStorageRoot,
  type StudioProjectRef,
} from '@gorenku/studio-core/server';
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

  try {
    const coordination = createStudioCoordinationService({
      homeDir: input.runtime.homeDir,
    });
    await coordination.appendStudioEvent({
      type: 'studio.projectResourcesChanged',
      projectRef: await toProjectRef(input.report.project, input.runtime.homeDir),
      resourceKeys: input.report.resourceKeys,
      source: { kind: 'cli', command: input.command },
      operationId: createStudioOperationId(),
    });
  } catch (error) {
    writeStudioResourceChangedWarning(input.runtime, error);
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
  error: unknown
): void {
  const detail =
    error instanceof Error
      ? error.message
      : 'Studio coordination event could not be appended.';
  if (runtime.json) {
    runtime.io.stderr.error(
      JSON.stringify(
        {
          warnings: [
            {
              code: 'CLI026',
              message:
                'Media import succeeded, but Studio refresh coordination failed.',
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
    `[CLI026] WARNING Media import succeeded, but Studio refresh coordination failed: ${detail}`
  );
}
