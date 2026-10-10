import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { consumeDirectionAction, generateDirectionTake, reportDirectionAction } from './actions.js';
import { directionToolResult } from './diagnostics.js';
import {
  dialogueDirectionConsumeSchema,
  dialogueDirectionGenerateSchema,
  dialogueDirectionReportSchema,
  dialogueDirectionTakeDiscardSchema,
  dialogueDirectionTakeSelectSchema,
} from './schemas.js';
import type { DialogueDirectionState } from './session-state.js';
import { discardDirectionTake, selectDirectionTake } from './take-mutations.js';

/** Registers the panel-only and agent-only tools shared by every dialogue direction panel. */
export function registerDirectionTools(server: McpServer, state: DialogueDirectionState, homeDir?: string): void {
  registerAppTool(server, 'dialogue.direction.generate', {
    title: 'Record a dialogue direction Generate action', inputSchema: dialogueDirectionGenerateSchema,
    _meta: { ui: { visibility: ['app'] } },
    annotations: { openWorldHint: false, destructiveHint: false },
  }, (input) => directionToolResult(async () => ({ content: [], structuredContent: { ...(await generateDirectionTake(state, input, homeDir)) } })));
  registerAppTool(server, 'dialogue.direction.take.select', {
    title: 'Select or clear a dialogue Take', inputSchema: dialogueDirectionTakeSelectSchema,
    _meta: { ui: { visibility: ['app'] } },
    annotations: { openWorldHint: false, destructiveHint: false },
  }, (input) => directionToolResult(async () => ({ content: [], structuredContent: { session: await selectDirectionTake(state, input, homeDir) } })));
  registerAppTool(server, 'dialogue.direction.take.discard', {
    title: 'Move a dialogue Take to the Trash', inputSchema: dialogueDirectionTakeDiscardSchema,
    _meta: { ui: { visibility: ['app'] } },
    annotations: { openWorldHint: false, destructiveHint: true },
  }, (input) => directionToolResult(async () => ({ content: [], structuredContent: { session: await discardDirectionTake(state, input, homeDir) } })));
  registerAppTool(server, 'dialogue.direction.consume', {
    title: 'Consume a dialogue direction Generate action', inputSchema: dialogueDirectionConsumeSchema,
    description: 'Consume the exact panel Generate action once. It returns the route id to execute and the user draft. alreadyConsumed authorizes no repeated execution. Execute only through the provider Skill and CLI, import with --turns, then call dialogue.direction.report.',
    _meta: { ui: { visibility: ['model'] } },
    annotations: { openWorldHint: false, destructiveHint: false },
  }, (input) => directionToolResult(async () => ({ content: [], structuredContent: { ...consumeDirectionAction(state, input) } })));
  registerAppTool(server, 'dialogue.direction.report', {
    title: 'Report a dialogue direction outcome', inputSchema: dialogueDirectionReportSchema,
    description: 'Report the consumed action as attached (with the imported Asset File id) or failed (with a user-readable message). The panel shows the outcome.',
    _meta: { ui: { visibility: ['model'] } },
    annotations: { openWorldHint: false, destructiveHint: false },
  }, (input) => directionToolResult(async () => ({ content: [], structuredContent: { session: await reportDirectionAction(state, input, homeDir) } })));
}
