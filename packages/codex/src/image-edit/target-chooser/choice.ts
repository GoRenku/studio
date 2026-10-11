import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import type { ImageEditTargetConsumeResult } from '../contracts.js';
import { imageEditToolResult } from '../diagnostics.js';
import { imageEditIdentity } from '../schemas.js';
import type { ImageEditTargetChooserState } from './chooser-state.js';

export const imageEditTargetRespondSchema = z.object({
  chooserId: imageEditIdentity,
  choice: z.discriminatedUnion('status', [
    z.object({ status: z.literal('chosen'), assetFileId: imageEditIdentity }).strict(),
    z.object({ status: z.literal('canceled') }).strict(),
  ]),
}).strict();

export const imageEditTargetConsumeSchema = z.object({ chooserId: imageEditIdentity }).strict();

export function registerImageEditTargetChoiceTools(server: McpServer, state: ImageEditTargetChooserState): void {
  registerAppTool(server, 'image.edit.target.respond', {
    title: 'Record the chosen image', inputSchema: imageEditTargetRespondSchema,
    _meta: { ui: { visibility: ['app'] } },
    annotations: { openWorldHint: false, destructiveHint: false },
  }, (input) => imageEditToolResult(async () => ({ content: [], structuredContent: { chooser: state.respond(input.chooserId, input.choice) } })));
  registerAppTool(server, 'image.edit.target.consume', {
    title: 'Consume the chosen image', inputSchema: imageEditTargetConsumeSchema,
    description: 'Consume the user\'s image choice once. chosen returns the exact Asset File to open the image edit panel on; canceled means stop quietly; alreadyConsumed means do nothing.',
    _meta: { ui: { visibility: ['model'] } },
    annotations: { openWorldHint: false, destructiveHint: false },
  }, (input) => imageEditToolResult(async () => ({ content: [], structuredContent: { ...consumeImageEditTargetChoice(state, input.chooserId) } })));
}

export function consumeImageEditTargetChoice(state: ImageEditTargetChooserState, chooserId: string): ImageEditTargetConsumeResult {
  const choice = state.consume(chooserId);
  if (!choice) return { status: 'alreadyConsumed', chooserId };
  if (choice.status === 'canceled') return { status: 'canceled', chooserId };
  return { status: 'chosen', chooserId, project: state.record(chooserId).projectRef.name, assetFileId: choice.assetFileId };
}
