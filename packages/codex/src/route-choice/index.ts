import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerPanelAppResource } from '../panel-sessions/panel-resources.js';
import { RouteChooserState } from './choice-state.js';
import { routeChoiceResourceResult } from './diagnostics.js';
import { ROUTE_CHOOSER_URI, registerRouteChooserOpening } from './opening.js';
import { registerRouteChooserResources } from './resources.js';
import { registerRouteChoiceTools } from './tools.js';

export interface RouteChoiceOptions {
  html: string;
  homeDir?: string;
}

export function registerRouteChoice(server: McpServer, options: RouteChoiceOptions): void {
  const state = new RouteChooserState();
  registerPanelAppResource(server, { uri: ROUTE_CHOOSER_URI, title: 'Choose provider and model', file: options.html, displayMode: 'inline' }, routeChoiceResourceResult);
  registerRouteChooserOpening(server, state, options.homeDir);
  registerRouteChoiceTools(server, state, options.homeDir);
  registerRouteChooserResources(server, state);
  const previousClose = server.server.onclose;
  server.server.onclose = () => {
    previousClose?.();
    state.expire();
  };
}
