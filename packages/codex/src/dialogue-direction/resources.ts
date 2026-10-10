import fs from 'node:fs/promises';
import { ResourceTemplate, type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { RESOURCE_MIME_TYPE, registerAppResource } from '@modelcontextprotocol/ext-apps/server';
import type { OpenAIUiResourceMetadata } from '@openai/mcp-extensions/server';
import { directionResourceResult } from './diagnostics.js';
import { readDirectionMedia } from './media-resources.js';
import { readDialogueDirectionSession } from './session-projection.js';
import type { DialogueDirectionState } from './session-state.js';

const FULLSCREEN_ONLY = { preferredDisplayMode: 'fullscreen', availableDisplayModes: ['fullscreen'] } satisfies OpenAIUiResourceMetadata;

/** Panels always open fullscreen; they never read generation review display preferences. */
export function registerDirectionPanelResource(server: McpServer, uri: string, title: string, file: string): void {
  registerAppResource(server, title, uri, {}, () => directionResourceResult(async () => ({
    contents: [{
      uri, mimeType: RESOURCE_MIME_TYPE, text: await fs.readFile(file, 'utf8'),
      _meta: { 'openai/ui': FULLSCREEN_ONLY, ui: { csp: { connectDomains: ['blob:'], resourceDomains: ['blob:'] } } },
    }],
  })));
}

export function registerDirectionSessionResources(server: McpServer, state: DialogueDirectionState, homeDir?: string): void {
  server.registerResource('Dialogue direction session', new ResourceTemplate('renku-direction://{sessionId}', { list: undefined }), { mimeType: 'application/json' }, (uri, variables) => directionResourceResult(async () => ({
    contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(await readDialogueDirectionSession(state, String(variables.sessionId), homeDir)) }],
  })));
  server.registerResource('Dialogue direction media', new ResourceTemplate('renku-direction://{sessionId}/media/{mediaId}', { list: undefined }), {}, (uri) => directionResourceResult(() => readDirectionMedia(state, uri.href, homeDir)));
}
