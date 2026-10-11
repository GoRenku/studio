import { ResourceTemplate, type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readPanelMedia } from '../panel-sessions/media-registry.js';
import { imageEditError, imageEditResourceResult } from './diagnostics.js';
import { readImageEditSession } from './session-projection.js';
import { IMAGE_EDIT_MEDIA_SCHEME, type ImageEditState } from './session-state.js';

export function registerImageEditSessionResources(server: McpServer, state: ImageEditState, homeDir?: string): void {
  server.registerResource('Image edit session', new ResourceTemplate(`${IMAGE_EDIT_MEDIA_SCHEME}://{sessionId}`, { list: undefined }), { mimeType: 'application/json' }, (uri, variables) => imageEditResourceResult(async () => ({
    contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(await readImageEditSession(state, String(variables.sessionId), homeDir)) }],
  })));
  server.registerResource('Image edit media', new ResourceTemplate(`${IMAGE_EDIT_MEDIA_SCHEME}://{sessionId}/media/{mediaId}`, { list: undefined }), {}, (uri) => imageEditResourceResult(() => readPanelMedia({
    uri: uri.href,
    scheme: IMAGE_EDIT_MEDIA_SCHEME,
    source: (sessionId) => {
      const record = state.record(sessionId);
      return { projectRef: record.projectRef, media: record.media };
    },
    notFound: () => imageEditError('CODEX_IMAGE_EDIT_NOT_FOUND', 'This image edit media is not available.'),
    homeDir,
  })));
}
