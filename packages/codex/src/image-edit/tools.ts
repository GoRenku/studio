import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { consumeImageEditAction, generateImageEdit, reportImageEditAction } from './actions.js';
import { imageEditToolResult } from './diagnostics.js';
import { imageEditConsumeSchema, imageEditGenerateSchema, imageEditReportSchema } from './schemas.js';
import type { ImageEditState } from './session-state.js';

/** Registers the panel-only and agent-only tools of the image edit panel. */
export function registerImageEditTools(server: McpServer, state: ImageEditState, homeDir?: string): void {
  registerAppTool(server, 'image.edit.generate', {
    title: 'Record an image edit Generate action', inputSchema: imageEditGenerateSchema,
    _meta: { ui: { visibility: ['app'] } },
    annotations: { openWorldHint: false, destructiveHint: false },
  }, (input) => imageEditToolResult(async () => ({ content: [], structuredContent: { ...(await generateImageEdit(state, input, homeDir)) } })));
  registerAppTool(server, 'image.edit.consume', {
    title: 'Consume an image edit Generate action', inputSchema: imageEditConsumeSchema,
    description: 'Consume the exact panel Generate action once. It returns the route, the exact base image and style reference paths, and the route-neutral user draft (whole-image instruction, regions on a 0–1000 grid with route mode ids, native control values by JSON Pointer). alreadyConsumed authorizes no repeated execution. Write the model prompt with the provider Skill, execute through the CLI, import with renku media import --purpose image.edit --target assetFile:<base id>, then call image.edit.report.',
    _meta: { ui: { visibility: ['model'] } },
    annotations: { openWorldHint: false, destructiveHint: false },
  }, (input) => imageEditToolResult(async () => ({ content: [], structuredContent: { ...(await consumeImageEditAction(state, input, homeDir)) } })));
  registerAppTool(server, 'image.edit.report', {
    title: 'Report an image edit outcome', inputSchema: imageEditReportSchema,
    description: 'Report the consumed action as attached (with the imported Asset File id) or failed (with a user-readable message). The panel shows the outcome.',
    _meta: { ui: { visibility: ['model'] } },
    annotations: { openWorldHint: false, destructiveHint: false },
  }, (input) => imageEditToolResult(async () => ({ content: [], structuredContent: { session: await reportImageEditAction(state, input, homeDir) } })));
}
