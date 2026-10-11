import type { StudioProjectRef } from '@gorenku/studio-core/server';
import type { PanelMediaRegistry } from '../../panel-sessions/media-registry.js';
import type { ImageEditTargetCandidate, ImageEditTargetChoice, ImageEditTargetChooser } from '../contracts.js';
import { imageEditError } from '../diagnostics.js';

export const IMAGE_EDIT_TARGET_MEDIA_SCHEME = 'renku-image-target';

export interface ImageEditTargetChooserRecord {
  chooserId: string;
  revision: number;
  projectRef: StudioProjectRef;
  candidates: ImageEditTargetCandidate[];
  suggestedAssetFileId: string;
  choice: ImageEditTargetChoice | null;
  consumed: boolean;
  media: PanelMediaRegistry;
}

/** Connection-local choosers: the user answers once and the agent consumes that answer once. */
export class ImageEditTargetChooserState {
  private readonly choosers = new Map<string, ImageEditTargetChooserRecord>();

  create(record: Omit<ImageEditTargetChooserRecord, 'revision' | 'choice' | 'consumed'>): ImageEditTargetChooser {
    this.choosers.set(record.chooserId, { ...record, revision: 1, choice: null, consumed: false });
    return this.chooser(record.chooserId);
  }

  record(chooserId: string): ImageEditTargetChooserRecord {
    const chooser = this.choosers.get(chooserId);
    if (!chooser) {
      throw imageEditError('CODEX_IMAGE_EDIT_NOT_FOUND', 'This image chooser does not exist in this connection.', 'Ask the agent to show the images again.');
    }
    return chooser;
  }

  chooser(chooserId: string): ImageEditTargetChooser {
    const { revision, candidates, suggestedAssetFileId, choice } = this.record(chooserId);
    return structuredClone({ chooserId, revision, candidates, suggestedAssetFileId, choice });
  }

  respond(chooserId: string, choice: ImageEditTargetChoice): ImageEditTargetChooser {
    const chooser = this.record(chooserId);
    if (chooser.choice) throw imageEditError('CODEX_IMAGE_EDIT_INVALID', 'This image choice was already answered.');
    if (choice.status === 'chosen' && !chooser.candidates.some((candidate) => candidate.assetFileId === choice.assetFileId)) {
      throw imageEditError('CODEX_IMAGE_EDIT_INVALID', `Asset File ${choice.assetFileId} is not one of the offered images.`);
    }
    chooser.choice = structuredClone(choice);
    chooser.revision += 1;
    return this.chooser(chooserId);
  }

  /** Returns the answer once; undefined when it was already consumed. */
  consume(chooserId: string): ImageEditTargetChoice | undefined {
    const chooser = this.record(chooserId);
    if (chooser.consumed) return undefined;
    if (!chooser.choice) throw imageEditError('CODEX_IMAGE_EDIT_INVALID', 'The user has not chosen an image yet.', 'End the turn and wait for the chooser message.');
    chooser.consumed = true;
    chooser.revision += 1;
    return structuredClone(chooser.choice);
  }

  expire(): void {
    this.choosers.clear();
  }
}
