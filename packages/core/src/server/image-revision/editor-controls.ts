import type { GenerationEditorControl } from '../../client/index.js';

export function singleOutputControls(): GenerationEditorControl[] {
  return [
    {
      controlId: 'outputCount',
      kind: 'readonly',
      label: 'Outputs',
      value: 1,
    },
  ];
}
