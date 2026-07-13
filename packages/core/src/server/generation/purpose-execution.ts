import type { GenerationSpec } from '../../client/generation.js';
import type { GenerationPurposeDescriptor } from './purpose-contract.js';
import { applyFixedGenerationSettings } from './purpose-settings.js';

export async function preparePurposeExecutionSpec(input: {
  spec: GenerationSpec;
  purpose: GenerationPurposeDescriptor;
  projectAspectRatio: string;
}): Promise<GenerationSpec> {
  const spec = await applyFixedGenerationSettings(input);
  if (spec.purpose !== 'scene.storyboard-sheet' || typeof spec.values.prompt !== 'string') {
    return spec;
  }
  return {
    ...spec,
    values: {
      ...spec.values,
      prompt: [
        spec.values.prompt,
        '',
        'Create one 4:3 storyboard sheet as a single finished image.',
        `Arrange one to four clean ${input.projectAspectRatio} storyboard panels in Shot List order in a 2x2 composite layout.`,
        'Leave unused panel positions empty; do not invent filler shots.',
        'Keep labels in the sheet header or margins and outside the shot image regions.',
      ].join('\n'),
    },
  };
}
