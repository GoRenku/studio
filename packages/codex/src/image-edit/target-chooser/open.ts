import { randomUUID } from 'node:crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import { assertGenerationReviewCapability } from '../../generation-review-capabilities.js';
import { PanelMediaRegistry } from '../../panel-sessions/media-registry.js';
import type { ImageEditTargetChooseInput, ImageEditTargetChooser } from '../contracts.js';
import { assertNoImageEditIssues, imageEditIssue, imageEditToolResult } from '../diagnostics.js';
import { resolveImageEditProject } from '../opening.js';
import { imageEditIdentity } from '../schemas.js';
import { readImageEditTargetsFor } from '../session-projection.js';
import { IMAGE_EDIT_TARGET_MEDIA_SCHEME, type ImageEditTargetChooserState } from './chooser-state.js';

export const IMAGE_EDIT_TARGET_CHOOSER_URI = 'ui://renku/image-edit/target-chooser';
export const IMAGE_EDIT_TARGET_CHOOSER_MAX_CANDIDATES = 24;

export const imageEditTargetChooseSchema = z.object({
  project: imageEditIdentity,
  assetFileIds: z.array(imageEditIdentity).min(2).max(IMAGE_EDIT_TARGET_CHOOSER_MAX_CANDIDATES).describe('Matching images, in the order to show them.'),
  suggestedAssetFileId: imageEditIdentity.describe('The best guess; must be one of assetFileIds.'),
}).strict();

export function registerImageEditTargetChooserOpening(server: McpServer, state: ImageEditTargetChooserState, homeDir?: string): void {
  registerAppTool(server, 'image.edit.target.choose', {
    title: 'Ask which image to edit',
    description: 'Show the matching images inline so the user picks the one to edit. Use only when the request matches more than one image. Return immediately and end the turn; the user\'s choice arrives as a message.',
    inputSchema: imageEditTargetChooseSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: { ui: { resourceUri: IMAGE_EDIT_TARGET_CHOOSER_URI, visibility: ['model'] } },
  }, (input) => imageEditToolResult(async () => {
    assertGenerationReviewCapability(server);
    const chooser = await openImageEditTargetChooser(state, input, homeDir);
    return {
      content: [{ type: 'text' as const, text: `Image chooser ${chooser.chooserId} is open. End the turn now and wait. The user's choice arrives as a message; consume it once with image.edit.target.consume.` }],
      structuredContent: { chooser },
    };
  }));
}

export async function openImageEditTargetChooser(state: ImageEditTargetChooserState, input: ImageEditTargetChooseInput, homeDir?: string): Promise<ImageEditTargetChooser> {
  assertNoImageEditIssues(
    input.assetFileIds.includes(input.suggestedAssetFileId) ? [] : [imageEditIssue(['suggestedAssetFileId'], 'The suggested image must be one of assetFileIds.')],
    'The image chooser cannot open.',
  );
  const projectRef = await resolveImageEditProject(input.project, homeDir);
  const targets = await readImageEditTargetsFor(projectRef, input.assetFileIds, homeDir);
  const chooserId = randomUUID();
  const media = new PanelMediaRegistry(IMAGE_EDIT_TARGET_MEDIA_SCHEME, chooserId);
  return state.create({
    chooserId,
    projectRef,
    suggestedAssetFileId: input.suggestedAssetFileId,
    media,
    candidates: targets.map((target) => ({
      assetFileId: target.assetFile.id,
      owner: { kind: target.owner.kind, name: target.ownerName },
      imageType: target.assetFile.type,
      takeNumber: target.takeNumber,
      selected: target.selected,
      createdAt: target.assetFile.createdAt,
      imageUri: media.uri(target.assetFile.projectRelativePath),
    })),
  });
}
