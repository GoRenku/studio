import { ResourceTemplate, type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readPanelMedia } from '../panel-sessions/media-registry.js';
import { registerPanelAppResource } from '../panel-sessions/panel-resources.js';
import { directionError, directionResourceResult } from './diagnostics.js';
import { readDialogueDirectionSession } from './session-projection.js';
import { DIALOGUE_DIRECTION_MEDIA_SCHEME, type DialogueDirectionState } from './session-state.js';

export function registerDirectionPanelResource(server: McpServer, uri: string, title: string, file: string): void {
  registerPanelAppResource(server, { uri, title, file, displayMode: 'fullscreen' }, directionResourceResult);
}

export function registerDirectionSessionResources(server: McpServer, state: DialogueDirectionState, homeDir?: string): void {
  server.registerResource('Dialogue direction session', new ResourceTemplate('renku-direction://{sessionId}', { list: undefined }), { mimeType: 'application/json' }, (uri, variables) => directionResourceResult(async () => ({
    contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(await readDialogueDirectionSession(state, String(variables.sessionId), homeDir)) }],
  })));
  server.registerResource('Dialogue direction media', new ResourceTemplate('renku-direction://{sessionId}/media/{mediaId}', { list: undefined }), {}, (uri) => directionResourceResult(() => readPanelMedia({
    uri: uri.href,
    scheme: DIALOGUE_DIRECTION_MEDIA_SCHEME,
    source: (sessionId) => {
      const record = state.record(sessionId);
      return { projectRef: record.binding.projectRef, media: record.media };
    },
    notFound: () => directionError('CODEX_DIALOGUE_DIRECTION_NOT_FOUND', 'This dialogue direction media is not available.'),
    homeDir,
  })));
}
