import type { AssetFileOwner } from '@gorenku/studio-core/client';
import type { StudioProjectRef } from '@gorenku/studio-core/server';
import type { PanelMediaRegistry } from '../panel-sessions/media-registry.js';
import { PanelSessionStore, type PanelSessionRecord } from '../panel-sessions/session-store.js';
import type { ImageEditDraft, ImageEditInitial, ImageEditPanel, ImageEditRoute } from './contracts.js';
import { imageEditError } from './diagnostics.js';

export const IMAGE_EDIT_MEDIA_SCHEME = 'renku-image-edit';

export interface ImageEditSessionParts {
  projectRef: StudioProjectRef;
  panel: ImageEditPanel;
  route: ImageEditRoute;
  owner: AssetFileOwner;
  ownerName: string | null;
  imageType: string;
  selectable: boolean;
  versionSourceAssetFileIds: string[];
  initial: ImageEditInitial;
  media: PanelMediaRegistry;
}

type ImageEditActionDetails = { baseAssetFileId: string };
type ImageEditCompletion = { actionId: string; assetFileId: string };

export type ImageEditSessionRecord = PanelSessionRecord<ImageEditSessionParts, ImageEditActionDetails, ImageEditCompletion>;

export class ImageEditState extends PanelSessionStore<ImageEditSessionParts, ImageEditDraft, ImageEditActionDetails, ImageEditCompletion> {
  constructor() {
    super({
      busy: () => imageEditError('CODEX_IMAGE_EDIT_BUSY', 'A Generate action is already outstanding for this panel.', 'Wait for the agent to report the current edit before generating again.'),
      sessionNotFound: () => imageEditError('CODEX_IMAGE_EDIT_NOT_FOUND', 'This image edit session does not exist in this connection.', 'Open a fresh image edit panel.'),
      actionNotFound: () => imageEditError('CODEX_IMAGE_EDIT_NOT_FOUND', 'This image edit action does not exist in this session.'),
      invalid: (message) => imageEditError('CODEX_IMAGE_EDIT_INVALID', message),
    });
  }
}
