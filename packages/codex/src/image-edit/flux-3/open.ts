import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import { assertGenerationReviewCapability } from '../../generation-review-capabilities.js';
import type { Flux3ImageEditOpenInput } from '../contracts.js';
import { imageEditToolResult } from '../diagnostics.js';
import { imageEditOpeningResult, openImageEditSession } from '../opening.js';
import { imageEditIdentity, imageEditResolutionSchema, imageEditRouteSchema } from '../schemas.js';
import type { ImageEditState } from '../session-state.js';

export const FLUX_3_IMAGE_EDIT_URI = 'ui://renku/image-edit/flux-3';

export const flux3ImageEditOpenSchema = z.object({
  project: imageEditIdentity,
  sourceAssetFileId: imageEditIdentity.describe('The exact image Asset File to edit.'),
  route: imageEditRouteSchema,
  wholeImageInstruction: z.string().max(4000).describe('Optional prefill from the user request; empty when none.'),
  resolution: imageEditResolutionSchema,
}).strict();

export function registerFlux3ImageEditOpening(server: McpServer, state: ImageEditState, homeDir?: string): void {
  registerAppTool(server, 'image.edit.flux-3.open', {
    title: 'Open the FLUX 3 image edit panel',
    description: 'Open the fullscreen FLUX 3 Image Edit panel on one exact image. The user marks regions and instructions and clicks Generate. Return immediately and end the turn. This tool never executes generation.',
    inputSchema: flux3ImageEditOpenSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: { ui: { resourceUri: FLUX_3_IMAGE_EDIT_URI, visibility: ['model'] } },
  }, (input) => imageEditToolResult(async () => {
    assertGenerationReviewCapability(server);
    return imageEditOpeningResult(await openFlux3ImageEdit(state, input, homeDir));
  }));
}

export function openFlux3ImageEdit(state: ImageEditState, input: Flux3ImageEditOpenInput, homeDir?: string) {
  return openImageEditSession(state, {
    project: input.project,
    sourceAssetFileId: input.sourceAssetFileId,
    route: input.route,
    panel: 'flux-3',
    initial: { wholeImageInstruction: input.wholeImageInstruction, resolution: input.resolution },
  }, homeDir);
}
