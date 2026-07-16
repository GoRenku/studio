import { describe, expect, it } from 'vitest';
import type { GenerationModelDescriptor } from '../../client/generation.js';
import { shotVideoTakeParameterAllowedValues } from './generation-parameter-presentation.js';

describe('Shot Video Take generation parameters', () => {
  it('removes automatic duration without inventing a default', () => {
    const field = durationField({
      defaultValue: 'auto',
      allowedValues: ['auto', '6', '4', '5'],
    });

    expect(shotVideoTakeParameterAllowedValues(field)).toEqual(['6', '4', '5']);
  });
});

function durationField(
  overrides: Partial<GenerationModelDescriptor['fields'][number]>
): GenerationModelDescriptor['fields'][number] {
  return {
    name: 'duration',
    label: 'Duration',
    kind: 'enum',
    semantic: { kind: 'setting', role: 'duration' },
    required: false,
    ...overrides,
  };
}
