import { ResourceTemplate, type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readPanelMedia } from '../panel-sessions/media-registry.js';
import { castingWardrobeError, castingWardrobeResourceResult } from './diagnostics.js';
import { CASTING_WARDROBE_SCHEME, type CastingWardrobeState } from './session-state.js';

export function registerCastingWardrobeResources(server: McpServer, state: CastingWardrobeState, homeDir?: string): void {
  server.registerResource('Looks and wardrobe plan', new ResourceTemplate(`${CASTING_WARDROBE_SCHEME}://{panelId}`, { list: undefined }), { mimeType: 'application/json' }, (uri, variables) => castingWardrobeResourceResult(async () => ({
    contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(state.read(String(variables.panelId))) }],
  })));
  server.registerResource('Looks and wardrobe media', new ResourceTemplate(`${CASTING_WARDROBE_SCHEME}://{panelId}/media/{mediaId}`, { list: undefined }), {}, (uri) => castingWardrobeResourceResult(() => readPanelMedia({
    uri: uri.href,
    scheme: CASTING_WARDROBE_SCHEME,
    source: (panelId) => state.record(panelId).context,
    notFound: () => castingWardrobeError('CODEX_CASTING_WARDROBE_NOT_FOUND', 'This Looks and wardrobe image is not available.'),
    homeDir,
  })));
}
