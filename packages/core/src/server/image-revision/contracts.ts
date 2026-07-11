import type {
  ImageRevisionDraft,
  ImageRevisionTarget,
} from '../../client/index.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';

export interface ReadImageRevisionContextInput extends RenkuConfigPathOptions {
  projectName?: string;
  target: ImageRevisionTarget;
}

export interface PreviewImageRevisionDraftInput
  extends ReadImageRevisionContextInput {
  draft: ImageRevisionDraft;
}

export interface EstimateImageRevisionDraftInput
  extends PreviewImageRevisionDraftInput {}

export interface RunImageRevisionInput extends PreviewImageRevisionDraftInput {
  approveLiveProviderRun: true;
  idGenerator?: ProjectIdGenerator;
}
