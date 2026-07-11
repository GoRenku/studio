import type {
  GenerationPreviewRequest,
  GenerationPreviewRequestReference,
  MediaGenerationSpecRecord,
  MediaGenerationTarget,
} from '../../client/index.js';
import { buildImagePreviewConfiguration } from './configuration/model-input-configuration.js';
import { providerPreviewPromptText } from './provider-preview-prompt.js';

export interface BuildSavedImageGenerationPreviewInput {
  specRecord: MediaGenerationSpecRecord;
  purpose: GenerationPreviewRequest['purpose'];
  project: {
    id?: string;
    name: string;
    title?: string;
  };
  target: MediaGenerationTarget;
  title: string;
  modelChoice: string;
  modelLabel?: string;
  provider: string;
  providerModel: string;
  mode: 'text-to-image' | 'reference-to-image' | 'image-edit';
  authoredPrompt: string;
  references: GenerationPreviewRequestReference[];
  payload: Record<string, unknown>;
  providerTokenOrder?: string[];
  promptSheetVisualStyleId?: GenerationPreviewRequest['promptSheetVisualStyleId'];
  promptSheetNotationModeId?: GenerationPreviewRequest['promptSheetNotationModeId'];
}

export async function buildSavedImageGenerationPreview(
  input: BuildSavedImageGenerationPreviewInput
): Promise<GenerationPreviewRequest> {
  return {
    kind: 'generationPreview',
    previewId: `generation-preview:${input.specRecord.id}`,
    generationSpecId: input.specRecord.id,
    purpose: input.purpose,
    project: {
      id: input.project.id ?? input.project.name,
      name: input.project.name,
      title: input.project.title,
    },
    target: input.target,
    title: input.title,
    model: {
      provider: input.provider,
      modelId: input.providerModel,
      route: input.providerModel,
      executionPath: 'renku-managed',
      mediaKind: 'image',
    },
    ...(input.promptSheetVisualStyleId
      ? { promptSheetVisualStyleId: input.promptSheetVisualStyleId }
      : {}),
    ...(input.promptSheetNotationModeId
      ? { promptSheetNotationModeId: input.promptSheetNotationModeId }
      : {}),
    finalPrompt: {
      authoredText: input.authoredPrompt,
      providerText: providerPreviewPromptText(input.payload, input.authoredPrompt),
    },
    references: input.references,
    configuration: await buildImagePreviewConfiguration({
      provider: input.provider,
      providerModel: input.providerModel,
      modelChoice: input.modelChoice,
      modelLabel: input.modelLabel,
      payload: input.payload,
    }),
    providerPreview: {
      provider: input.provider,
      model: input.providerModel,
      mode: input.mode,
      providerTokenOrder:
        input.providerTokenOrder ??
        input.references
          .filter((reference) => reference.selected)
          .map((reference) => reference.assetFileId),
      payload: input.payload,
    },
    diagnostics: [],
  };
}
