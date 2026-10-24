import {
  createStudioOperationId,
  notifyStudioProjectResourcesChanged,
  type StudioProjectRef,
} from '@gorenku/studio-core/server';

/** Tells a running Studio which project resources a panel tool changed through Core. */
export async function notifyPanelProjectWrite(input: { projectRef: StudioProjectRef; resourceKeys: string[]; tool: string; homeDir?: string }): Promise<void> {
  await notifyStudioProjectResourcesChanged({
    homeDir: input.homeDir,
    notification: {
      projectRef: input.projectRef,
      resourceKeys: input.resourceKeys,
      source: { kind: 'cli', command: `renku studio mcp ${input.tool}` },
      operationId: createStudioOperationId(),
    },
  });
}
