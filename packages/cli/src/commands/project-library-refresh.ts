import {
  createStudioCoordinationService,
  createStudioOperationId,
  resolveRenkuStorageRoot,
} from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../cli.js';

export interface ProjectLibraryRefreshInput {
  options: { homeDir?: string; storageRoot?: string; io: RenkuCliIo; json: boolean };
  command: string;
  /** What already succeeded, for the warning, e.g. "Project was created". */
  completedAction: string;
  projectName: string;
  projectId?: string;
}

/** Asks a running Studio to refresh its Project Library; warns with CLI027 on failure. */
export async function appendProjectLibraryRefreshEvent(input: ProjectLibraryRefreshInput): Promise<void> {
  try {
    const coordination = createStudioCoordinationService({
      homeDir: input.options.homeDir,
    });
    await coordination.appendStudioEvent({
      type: 'studio.projectRefreshRequested',
      projectRef: {
        name: input.projectName,
        id: input.projectId ?? input.projectName,
        storageRoot: await resolveRenkuStorageRoot({
          homeDir: input.options.homeDir,
          storageRoot: input.options.storageRoot,
        }),
      },
      surface: 'projectLibrary',
      source: { kind: 'cli', command: input.command },
      operationId: createStudioOperationId(),
    });
  } catch (error) {
    const detail =
      error instanceof Error
        ? error.message
        : 'Studio coordination event could not be appended.';
    const message = `${input.completedAction}, but Studio project library refresh coordination failed`;
    if (input.options.json) {
      input.options.io.stderr.error(
        JSON.stringify(
          {
            warnings: [
              {
                code: 'CLI027',
                message: `${message}.`,
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
    input.options.io.stderr.error(
      `[CLI027] WARNING ${message}: ${detail}`
    );
  }
}
