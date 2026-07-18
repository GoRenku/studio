import type {
  GenerationModelDescriptor,
  GenerationPreview,
} from '../../client/generation.js';
import type { GenerationPreviewPrompt } from '../../client/generation-preview-resource.js';

export function projectGenerationPreviewPrompt(input: {
  preview: GenerationPreview;
  model?: GenerationModelDescriptor;
}): GenerationPreviewPrompt {
  const promptField = input.model?.fields.find(
    (field) =>
      field.semantic?.kind === 'authored-text' &&
      field.semantic.role === 'prompt'
  );
  const negativeField = input.model?.fields.find(
    (field) =>
      field.semantic?.kind === 'authored-text' &&
      field.semantic.role === 'negative-prompt'
  );
  const authoredText = stringValue(
    promptField
      ? input.preview.spec.values[promptField.name]
      : input.preview.spec.values.prompt
  );
  const providerText = stringValue(
    promptField ? input.preview.providerPayload?.[promptField.name] : undefined
  ) ?? authoredText ?? '';
  const negativeText = stringValue(
    negativeField ? input.preview.spec.values[negativeField.name] : undefined
  );
  return {
    authoredText: authoredText ?? '',
    providerText,
    ...(negativeText !== undefined ? { negativeText } : {}),
  };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
