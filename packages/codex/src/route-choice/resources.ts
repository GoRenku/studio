import { ResourceTemplate, type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RouteChooserState } from './choice-state.js';
import { routeChoiceResourceResult } from './diagnostics.js';

export const ROUTE_CHOICE_SCHEME = 'renku-route-choice';

export function registerRouteChooserResources(server: McpServer, state: RouteChooserState): void {
  server.registerResource('Route Chooser', new ResourceTemplate(`${ROUTE_CHOICE_SCHEME}://{choiceId}`, { list: undefined }), { mimeType: 'application/json' }, (uri, variables) => routeChoiceResourceResult(async () => ({
    contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(state.chooser(String(variables.choiceId))) }],
  })));
}
