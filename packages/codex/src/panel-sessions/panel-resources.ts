import fs from 'node:fs/promises';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { RESOURCE_MIME_TYPE, registerAppResource } from '@modelcontextprotocol/ext-apps/server';
import type { OpenAIUiResourceMetadata } from '@openai/mcp-extensions/server';

export type PanelDisplayMode = 'fullscreen' | 'inline';

/** Panels have one fixed display mode; they never read generation review display preferences. */
export function registerPanelAppResource(
  server: McpServer,
  panel: { uri: string; title: string; file: string; displayMode: PanelDisplayMode },
  resourceResult: (operation: () => Promise<ReadResourceResult>) => Promise<ReadResourceResult>,
): void {
  const ui = { preferredDisplayMode: panel.displayMode, availableDisplayModes: [panel.displayMode] } satisfies OpenAIUiResourceMetadata;
  registerAppResource(server, panel.title, panel.uri, {}, () => resourceResult(async () => ({
    contents: [{
      uri: panel.uri, mimeType: RESOURCE_MIME_TYPE, text: await fs.readFile(panel.file, 'utf8'),
      _meta: { 'openai/ui': ui, ui: { csp: { connectDomains: ['blob:'], resourceDomains: ['blob:'] } } },
    }],
  })));
}
