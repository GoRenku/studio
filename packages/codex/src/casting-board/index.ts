import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerPanelAppResource } from '../panel-sessions/panel-resources.js';
import { castingBoardResourceResult } from './diagnostics.js';
import { CASTING_BOARD_URI, registerCastingBoardOpening } from './opening.js';
import { registerCastingBoardResources } from './resources.js';
import { CastingBoardState } from './session-state.js';
import { registerCastingBoardTools } from './tools.js';

export interface CastingBoardOptions {
  html: string;
  homeDir?: string;
}

export function registerCastingBoard(server: McpServer, options: CastingBoardOptions): void {
  const state = new CastingBoardState();
  registerPanelAppResource(server, { uri: CASTING_BOARD_URI, title: 'Casting board', file: options.html, displayMode: 'fullscreen' }, castingBoardResourceResult);
  registerCastingBoardOpening(server, state, options.homeDir);
  registerCastingBoardTools(server, state, options.homeDir);
  registerCastingBoardResources(server, state, options.homeDir);
  const previousClose = server.server.onclose;
  server.server.onclose = () => {
    previousClose?.();
    state.expire();
  };
}
