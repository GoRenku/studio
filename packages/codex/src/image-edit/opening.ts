import { randomUUID } from 'node:crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { createProjectDataService, type StudioProjectRef } from '@gorenku/studio-core/server';
import { isStructuredError } from '@gorenku/studio-diagnostics';
import { assertGenerationReviewCapability } from '../generation-review-capabilities.js';
import { PanelMediaRegistry } from '../panel-sessions/media-registry.js';
import type { ImageEditOpenInput, ImageEditSession } from './contracts.js';
import { assertNoImageEditIssues, imageEditError, imageEditToolResult } from './diagnostics.js';
import { imageEditRouteIssues } from './route-validation.js';
import { imageEditOpenSchema } from './schemas.js';
import { projectImageEditSession, readImageEditTargetsFor } from './session-projection.js';
import { IMAGE_EDIT_MEDIA_SCHEME, type ImageEditState } from './session-state.js';

export const IMAGE_EDIT_URI = 'ui://renku/image-edit';

export function registerImageEditOpening(server: McpServer, state: ImageEditState, homeDir?: string): void {
  registerAppTool(server, 'image.edit.open', {
    title: 'Open the image edit panel',
    description: 'Open the fullscreen image edit panel on one exact image, described by the route\'s `## Codex panel` block. The user describes the change, marks regions when the route takes them, and clicks Generate. Return immediately and end the turn. This tool never executes generation.',
    inputSchema: imageEditOpenSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: { ui: { resourceUri: IMAGE_EDIT_URI, visibility: ['model'] } },
  }, (input) => imageEditToolResult(async () => {
    assertGenerationReviewCapability(server);
    return imageEditOpeningResult(await openImageEditSession(state, input, homeDir));
  }));
}

function imageEditOpeningResult(session: ImageEditSession) {
  return {
    content: [{ type: 'text' as const, text: `Image edit session ${session.sessionId} is open. End the turn now and wait. Each Generate click posts a message naming a session and action; consume it once with image.edit.consume, write the model prompt, execute through the provider Skill and CLI, import with renku media import --purpose image.edit, then call image.edit.report.` }],
    structuredContent: { session },
  };
}

export async function openImageEditSession(state: ImageEditState, input: ImageEditOpenInput, homeDir?: string): Promise<ImageEditSession> {
  assertNoImageEditIssues(imageEditRouteIssues(input.route), 'The image edit panel cannot open.');
  const projectRef = await resolveImageEditProject(input.project, homeDir);
  const [source] = await readImageEditTargetsFor(projectRef, [input.sourceAssetFileId], homeDir);
  const sessionId = randomUUID();
  const record = state.create(sessionId, {
    projectRef,
    route: input.route,
    owner: source!.owner,
    ownerName: source!.ownerName,
    imageType: source!.assetFile.type,
    selectable: source!.selectable,
    versionSourceAssetFileIds: [source!.assetFile.id],
    initialWholeImageInstruction: input.initialWholeImageInstruction,
    media: new PanelMediaRegistry(IMAGE_EDIT_MEDIA_SCHEME, sessionId),
  });
  return projectImageEditSession(record, homeDir);
}

export async function resolveImageEditProject(project: string, homeDir?: string): Promise<StudioProjectRef> {
  try {
    return await createProjectDataService().resolveStudioProjectRef({ projectName: project, homeDir });
  } catch (error) {
    if (isStructuredError(error)) throw error;
    throw imageEditError('CODEX_IMAGE_EDIT_INVALID', `Project ${project} could not be resolved.`);
  }
}
