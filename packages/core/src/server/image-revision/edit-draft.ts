import type {
  GenerationEditorControl,
  ImageEditGenerationSpec,
  ImageEditModelListReport,
  ImageRevisionDraft,
} from '../../client/index.js';
import { IMAGE_EDIT_GENERATION_PURPOSE } from '../../client/index.js';
import { ProjectDataError } from '../project-data-error.js';

export function createEditDraft(input: {
  assetId: string;
  assetFileId: string;
  models: ImageEditModelListReport;
  recommendedModelChoice: ImageEditGenerationSpec['modelChoice'];
}): { draft: ImageRevisionDraft; controls: GenerationEditorControl[] } {
  const model =
    input.models.models.find(
      (candidate) =>
        candidate.modelChoice === input.recommendedModelChoice &&
        candidate.available,
    ) ?? input.models.models.find((candidate) => candidate.available);
  if (!model) {
    throw new ProjectDataError(
      'CORE_IMAGE_REVISION_DRAFT_INVALID',
      'No available image-edit model can revise this image.',
    );
  }
  return {
    draft: {
      mode: 'edit',
      authoredText: '',
      referenceSelections: [],
      generationControls: [
        { controlId: 'modelChoice', value: model.modelChoice },
        ...Object.entries(model.defaultParameterValues).map(([controlId, value]) => ({
          controlId,
          value: value as never,
        })),
        { controlId: 'num_images', value: 1 },
      ],
    },
    controls: [
      {
        controlId: 'modelChoice',
        kind: 'readonly',
        label: 'Model',
        value: model.modelChoice,
      },
      ...model.parameterRows
        .filter((row) => row.key !== 'num_images')
        .map((row): GenerationEditorControl => {
        const value =
          model.defaultParameterValues[row.key] ?? row.defaultValue ?? null;
        if (
          row.allowedValues &&
          row.allowedValues.every((candidate) =>
            ['string', 'number', 'boolean'].includes(typeof candidate),
          )
        ) {
          return {
            controlId: row.key,
            kind: 'select',
            label: row.label,
            value: value as never,
            required: row.required,
            options: row.allowedValues.map((candidate) => ({
              label: String(candidate),
              value: candidate as never,
            })),
          };
        }
        if (typeof value === 'number') {
          return {
            controlId: row.key,
            kind: 'number',
            label: row.label,
            value,
            required: row.required,
            ...(row.minimum !== undefined ? { min: row.minimum } : {}),
            ...(row.maximum !== undefined ? { max: row.maximum } : {}),
          };
        }
        return {
          controlId: row.key,
          kind: 'readonly',
          label: row.label,
          value: value as never,
        };
        }),
      {
        controlId: 'num_images',
        kind: 'readonly',
        label: 'Outputs',
        value: 1,
      },
    ],
  };
}

export function applyEditDraft(input: {
  assetId: string;
  assetFileId: string;
  draft: ImageRevisionDraft;
  controls: GenerationEditorControl[];
}): ImageEditGenerationSpec {
  if (input.draft.mode !== 'edit' || !input.draft.authoredText.trim()) {
    throw new ProjectDataError(
      'CORE_IMAGE_REVISION_DRAFT_INVALID',
      'Image Edit instructions must not be empty.',
    );
  }
  const supported = new Set(input.controls.map((control) => control.controlId));
  const values = Object.fromEntries(
    input.draft.generationControls.map((control) => {
      if (!supported.has(control.controlId)) {
        throw new ProjectDataError(
          'CORE_IMAGE_REVISION_CONTROL_UNSUPPORTED',
          `Unsupported Image Revision control: ${control.controlId}.`,
        );
      }
      return [control.controlId, control.value];
    }),
  );
  const modelChoice = values.modelChoice;
  if (typeof modelChoice !== 'string') {
    throw new ProjectDataError(
      'CORE_IMAGE_REVISION_DRAFT_INVALID',
      'Image Edit requires a model selection.',
    );
  }
  const { modelChoice: _modelChoice, ...parameterValues } = values;
  return {
    purpose: IMAGE_EDIT_GENERATION_PURPOSE,
    target: { kind: 'asset', id: input.assetId },
    sourceAssetFileId: input.assetFileId,
    modelChoice: modelChoice as ImageEditGenerationSpec['modelChoice'],
    prompt: input.draft.authoredText,
    parameterValues: { ...parameterValues, num_images: 1 },
  };
}
