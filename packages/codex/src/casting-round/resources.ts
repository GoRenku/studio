import { ResourceTemplate, type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readPanelMedia } from '../panel-sessions/media-registry.js';
import { castingRoundError, castingRoundResourceResult } from './diagnostics.js';
import { CASTING_ROUND_SCHEME, type CastingRoundState } from './session-state.js';

export function registerCastingRoundResources(server: McpServer, state: CastingRoundState, homeDir?: string): void {
  server.registerResource('Casting round', new ResourceTemplate(`${CASTING_ROUND_SCHEME}://{panelId}`, { list: undefined }), { mimeType: 'application/json' }, (uri, variables) => castingRoundResourceResult(async () => ({
    contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(state.read(String(variables.panelId))) }],
  })));
  server.registerResource('Casting round media', new ResourceTemplate(`${CASTING_ROUND_SCHEME}://{panelId}/media/{mediaId}`, { list: undefined }), {}, (uri) => castingRoundResourceResult(() => readPanelMedia({
    uri: uri.href,
    scheme: CASTING_ROUND_SCHEME,
    source: (panelId) => state.record(panelId).context,
    notFound: () => castingRoundError('CODEX_CASTING_ROUND_NOT_FOUND', 'This Casting round reference is not available.'),
    homeDir,
  })));
}
