import type { GenerationSpec } from '../../client/generation.js';
import type { GenerationPurposeDescriptor } from './purpose-contract.js';
import { applyFixedGenerationSettings } from './purpose-settings.js';

export async function preparePurposeExecutionSpec(input: {
  spec: GenerationSpec;
  purpose: GenerationPurposeDescriptor;
  projectAspectRatio: string;
}): Promise<GenerationSpec> {
  if (input.spec.executionKind === 'agent-external') {
    return structuredClone(input.spec);
  }
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
        'Create one storyboard sheet as a single finished image using an output canvas supported by the selected model.',
        `Arrange one to four complete ${input.projectAspectRatio} storyboard panels in Beat order in a clean grid within that canvas.`,
        `Keep every panel at ${input.projectAspectRatio}; do not crop, stretch, overlap, or merge panel image regions.`,
        'Preserve clear gutters around every panel, and leave unused canvas space empty rather than inventing filler images.',
        'Keep labels in the sheet header, margins, or gutters and outside the storyboard panel image regions.',
      ].join('\n'),
    },
  };
}
