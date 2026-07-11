import type { MediaGenerationSpec } from '../../client/index.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';

export interface BuildMediaGenerationPreviewInput
  extends RenkuConfigPathOptions {
  projectName?: string;
  specId: string;
}

export interface BuildDraftMediaGenerationPreviewInput
  extends RenkuConfigPathOptions {
  projectName?: string;
  spec: MediaGenerationSpec;
}

export interface GenerationPreviewPromptUpdate {
  authoredText: string;
  negativeText?: string | null;
}

export interface GenerationPreviewReferenceSelectionUpdate {
  dependencyId: string;
  selected: boolean;
}

export interface UpdateGenerationPreviewSpecInput
  extends BuildMediaGenerationPreviewInput {
  prompt: GenerationPreviewPromptUpdate;
  referenceSelections: GenerationPreviewReferenceSelectionUpdate[];
}
