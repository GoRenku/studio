import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GenerationCostEstimator } from '../generation-review-estimate.js';
import { registerPanelAppResource } from '../panel-sessions/panel-resources.js';
import { castingRoundResourceResult } from './diagnostics.js';
import { CASTING_ROUND_URI, registerCastingRoundOpening } from './opening.js';
import { registerCastingRoundResources } from './resources.js';
import { CastingRoundState } from './session-state.js';
import { registerCastingRoundTools } from './tools.js';

export interface CastingRoundOptions {
  html: string;
  costEstimator: GenerationCostEstimator;
  homeDir?: string;
}

export function registerCastingRound(server: McpServer, options: CastingRoundOptions): void {
  const state = new CastingRoundState();
  registerPanelAppResource(server, { uri: CASTING_ROUND_URI, title: 'Casting round', file: options.html, displayMode: 'fullscreen' }, castingRoundResourceResult);
  registerCastingRoundOpening(server, state, options.costEstimator, options.homeDir);
  registerCastingRoundTools(server, state, options.homeDir);
  registerCastingRoundResources(server, state, options.homeDir);
  const previousClose = server.server.onclose;
  server.server.onclose = () => {
    previousClose?.();
    state.expire();
  };
}
