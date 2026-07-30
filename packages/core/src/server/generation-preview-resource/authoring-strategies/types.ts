import type {
  GenerationModelDescriptor,
  GenerationPreview,
  GenerationReferenceSlotSelectionInput,
  GenerationSpec,
  JsonValue,
  ShotPlanVideoInputMode,
} from '../../../client/generation.js';
import type {
  GenerationPreviewAuthoring,
} from '../../../client/generation-preview-resource.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import type { GenerationPurposeDescriptor } from '../../generation/purpose-contract.js';

export interface GenerationPreviewAuthoringProjectionInput {
  preview: GenerationPreview;
  model?: GenerationModelDescriptor;
}

export interface GenerationPreviewAuthoringStrategy {
  project(
    input: GenerationPreviewAuthoringProjectionInput,
  ): Promise<GenerationPreviewAuthoring>;
  update(
    input: GenerationPreviewAuthoringUpdateInput,
  ): Promise<GenerationSpec>;
}

export interface GenerationPreviewAuthoringUpdateInput {
  spec: GenerationSpec;
  prompt: { authoredText: string; negativeText?: string | null };
  modelFamilyId: string;
  shotPlanVideoInputMode?: ShotPlanVideoInputMode;
  parameterValues: Record<string, JsonValue>;
  slotSelections: GenerationReferenceSlotSelectionInput[];
  purpose: GenerationPurposeDescriptor;
  availableModels: GenerationModelDescriptor[];
  session: DatabaseSession;
  projectFolder: string;
}
