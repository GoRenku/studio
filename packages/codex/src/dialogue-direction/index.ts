import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DIALOGUE_DIRECTION_URI, registerDialogueDirectionOpening } from './opening.js';
import { registerDirectionPanelResource, registerDirectionSessionResources } from './resources.js';
import { DialogueDirectionState } from './session-state.js';
import { registerDirectionTools } from './tools.js';

export interface DialogueDirectionOptions {
  html: string;
  homeDir?: string;
}

export function registerDialogueDirection(server: McpServer, options: DialogueDirectionOptions): void {
  const state = new DialogueDirectionState();
  registerDirectionPanelResource(server, DIALOGUE_DIRECTION_URI, 'Dialogue direction', options.html);
  registerDialogueDirectionOpening(server, state, options.homeDir);
  registerDirectionTools(server, state, options.homeDir);
  registerDirectionSessionResources(server, state, options.homeDir);
  const previousClose = server.server.onclose;
  server.server.onclose = () => {
    previousClose?.();
    state.expire();
  };
}
