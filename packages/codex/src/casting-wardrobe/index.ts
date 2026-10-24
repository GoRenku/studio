import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerPanelAppResource } from '../panel-sessions/panel-resources.js';
import { castingWardrobeResourceResult } from './diagnostics.js';
import { CASTING_WARDROBE_URI, registerCastingWardrobeOpening } from './opening.js';
import { registerCastingWardrobeResources } from './resources.js';
import { CastingWardrobeState } from './session-state.js';
import { registerCastingWardrobeTools } from './tools.js';

export interface CastingWardrobeOptions {
  html: string;
  homeDir?: string;
}

export function registerCastingWardrobe(server: McpServer, options: CastingWardrobeOptions): void {
  const state = new CastingWardrobeState();
  registerPanelAppResource(server, { uri: CASTING_WARDROBE_URI, title: 'Looks and wardrobe', file: options.html, displayMode: 'inline' }, castingWardrobeResourceResult);
  registerCastingWardrobeOpening(server, state, options.homeDir);
  registerCastingWardrobeTools(server, state);
  registerCastingWardrobeResources(server, state, options.homeDir);
  const previousClose = server.server.onclose;
  server.server.onclose = () => {
    previousClose?.();
    state.expire();
  };
}
