import { randomUUID } from 'node:crypto';
import { createProjectDataService, type StudioProjectRef } from '@gorenku/studio-core/server';
import { isStructuredError } from '@gorenku/studio-diagnostics';
import { PanelMediaRegistry } from '../panel-sessions/media-registry.js';
import type { ImageEditInitial, ImageEditPanel, ImageEditRoute, ImageEditSession } from './contracts.js';
import { imageEditError } from './diagnostics.js';
import { projectImageEditSession, readImageEditTargetsFor } from './session-projection.js';
import { IMAGE_EDIT_MEDIA_SCHEME, type ImageEditState } from './session-state.js';

export interface ImageEditOpeningInput {
  project: string;
  sourceAssetFileId: string;
  route: ImageEditRoute;
  panel: ImageEditPanel;
  initial: ImageEditInitial;
}

export function imageEditOpeningResult(session: ImageEditSession) {
  return {
    content: [{ type: 'text' as const, text: `Image edit session ${session.sessionId} is open. End the turn now and wait. Each Generate click posts a message naming a session and action; consume it once with image.edit.consume, write the model prompt, execute through the provider Skill and CLI, import with renku media import --purpose image.edit, then call image.edit.report.` }],
    structuredContent: { session },
  };
}

export async function openImageEditSession(state: ImageEditState, input: ImageEditOpeningInput, homeDir?: string): Promise<ImageEditSession> {
  const projectRef = await resolveImageEditProject(input.project, homeDir);
  const [source] = await readImageEditTargetsFor(projectRef, [input.sourceAssetFileId], homeDir);
  const sessionId = randomUUID();
  const record = state.create(sessionId, {
    projectRef,
    panel: input.panel,
    route: input.route,
    owner: source!.owner,
    ownerName: source!.ownerName,
    imageType: source!.assetFile.type,
    selectable: source!.selectable,
    versionSourceAssetFileIds: [source!.assetFile.id],
    initial: input.initial,
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
