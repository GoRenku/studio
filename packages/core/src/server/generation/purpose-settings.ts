import { bindGenerationProductSettings, describeGenerationModelInputs } from '@gorenku/studio-engines';
import type { GenerationSpec } from '../../client/generation.js';
import { ProjectDataError } from '../project-data-error.js';
import type { GenerationPurposeDescriptor } from './purpose-contract.js';

export async function applyFixedGenerationSettings(input: {
  spec: GenerationSpec;
  purpose: GenerationPurposeDescriptor;
}): Promise<GenerationSpec> {
  if (input.purpose.settings.fixed.length === 0 || !input.spec.model?.provider || !input.spec.model.model) {
    return structuredClone(input.spec);
  }
  const descriptor = await describeGenerationModelInputs({
    provider: input.spec.model.provider,
    model: input.spec.model.model,
  });
  if (!descriptor) {
    return structuredClone(input.spec);
  }
  const binding = bindGenerationProductSettings({
    descriptor,
    settings: input.purpose.settings.fixed.map((setting) => ({
      kind: setting.kind,
      value: setting.value as string | number | boolean | null,
    })),
  });
  if (!binding.valid) {
    throw new ProjectDataError(
      'CORE_GENERATION_FIXED_SETTING_UNAVAILABLE',
      binding.issues.map((issue) => issue.message).join(' ')
    );
  }
  const spec = structuredClone(input.spec);
  for (const [field, value] of Object.entries(binding.values)) {
    if (field in spec.values && spec.values[field] !== value) {
      throw new ProjectDataError(
        'CORE_GENERATION_FIXED_SETTING_INVALID',
        `Generation field ${field} is fixed to ${String(value)} for ${input.purpose.purpose}.`
      );
    }
    spec.values[field] = value;
  }
  return spec;
}
