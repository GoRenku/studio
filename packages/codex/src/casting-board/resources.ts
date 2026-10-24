import { ResourceTemplate, type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readPanelMedia } from '../panel-sessions/media-registry.js';
import { castingBoardError, castingBoardResourceResult } from './diagnostics.js';
import { readCastingBoard } from './session-projection.js';
import { CASTING_BOARD_SCHEME, type CastingBoardState } from './session-state.js';

export function registerCastingBoardResources(server: McpServer, state: CastingBoardState, homeDir?: string): void {
  server.registerResource('Casting board', new ResourceTemplate(`${CASTING_BOARD_SCHEME}://{sessionId}`, { list: undefined }), { mimeType: 'application/json' }, (uri, variables) => castingBoardResourceResult(async () => ({
    contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(await readCastingBoard(state, String(variables.sessionId), homeDir)) }],
  })));
  server.registerResource('Casting board media', new ResourceTemplate(`${CASTING_BOARD_SCHEME}://{sessionId}/media/{mediaId}`, { list: undefined }), {}, (uri) => castingBoardResourceResult(() => readPanelMedia({
    uri: uri.href,
    scheme: CASTING_BOARD_SCHEME,
    source: (sessionId) => {
      const record = state.record(sessionId);
      return { projectRef: record.projectRef, media: record.media };
    },
    notFound: () => castingBoardError('CODEX_CASTING_BOARD_NOT_FOUND', 'This casting board image is not available.'),
    homeDir,
  })));
}
