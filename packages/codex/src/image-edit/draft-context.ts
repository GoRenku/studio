import type { ImageEditDraft } from './contracts.js';

/** Session facts a model's draft validator checks the draft against. */
export interface ImageEditDraftContext {
  editBaseAssetFileId: string | null;
  styleReferenceAssetFileIds: string[];
}

export type ImageEditDraftValidator = (draft: unknown, context: ImageEditDraftContext) => ImageEditDraft;
