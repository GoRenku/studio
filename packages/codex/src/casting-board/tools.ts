import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { actOnCastingBoard, requestFromCastingBoard } from './board-actions.js';
import { consumeCastingBoardRequest } from './board-requests.js';
import { castingBoardToolResult } from './diagnostics.js';
import { castingBoardActSchema, castingBoardConsumeSchema, castingBoardRequestSchema } from './schemas.js';
import type { CastingBoardState } from './session-state.js';

/** Registers the panel-only and agent-only tools of the casting board. */
export function registerCastingBoardTools(server: McpServer, state: CastingBoardState, homeDir?: string): void {
  registerAppTool(server, 'casting.board.act', {
    title: 'Save a casting board action', inputSchema: castingBoardActSchema,
    _meta: { ui: { visibility: ['app'] } },
    annotations: { openWorldHint: false, destructiveHint: false },
  }, (input) => castingBoardToolResult(async () => ({ content: [], structuredContent: { ...(await actOnCastingBoard(state, input, homeDir)) } })));
  registerAppTool(server, 'casting.board.request', {
    title: 'Send a casting board request to the agent', inputSchema: castingBoardRequestSchema,
    _meta: { ui: { visibility: ['app'] } },
    annotations: { openWorldHint: false, destructiveHint: false },
  }, (input) => castingBoardToolResult(async () => ({ content: [], structuredContent: { ...(await requestFromCastingBoard(state, input, homeDir)) } })));
  registerAppTool(server, 'casting.board.consume', {
    title: 'Consume the casting board request',
    description: 'Consume the latest casting board request once. moreLikeKept names the Look or costume, the ids of every image the user kept (not hidden) there, and the user\'s notes: open a new Casting round panel for that subject with them as references. cast names the candidate already selected for the Look. Sheet picks are saved directly and send nothing. alreadyConsumed authorizes nothing.',
    inputSchema: castingBoardConsumeSchema,
    _meta: { ui: { visibility: ['model'] } },
    annotations: { openWorldHint: false, destructiveHint: false },
  }, (input) => castingBoardToolResult(async () => ({ content: [], structuredContent: { ...consumeCastingBoardRequest(state, input.sessionId) } })));
}
