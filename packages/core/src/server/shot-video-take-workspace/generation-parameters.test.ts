import { describe, expect, it } from 'vitest';
import type { GenerationModelDescriptor } from '../../client/generation.js';
import {
  normalizeShotVideoTakeParameterValues,
  shotVideoTakeParameterAllowedValues,
  shotVideoTakeParameterDefaultValue,
} from './generation-parameters.js';

describe('Shot Video Take generation parameters', () => {
  it('removes automatic duration and selects the lowest schema duration', () => {
    const field = durationField({
      defaultValue: 'auto',
      allowedValues: ['auto', '6', '4', '5'],
    });

    expect(shotVideoTakeParameterAllowedValues(field)).toEqual(['6', '4', '5']);
    expect(shotVideoTakeParameterDefaultValue(field)).toBe('4');
  });

  it('uses the minimum for a numeric duration range', () => {
    const field = durationField({ defaultValue: null, minimum: 3, maximum: 15 });

    expect(shotVideoTakeParameterDefaultValue(field)).toBe(3);
  });

  it('materializes the minimum duration when setup omitted it', () => {
    const field = durationField({
      defaultValue: 'auto',
      allowedValues: ['auto', '4', '5'],
    });

    expect(normalizeShotVideoTakeParameterValues({
      fields: [field],
      values: { resolution: '720p' },
    })).toEqual({ duration: '4', resolution: '720p' });
  });

  it('replaces the provider automatic duration but preserves an explicit duration', () => {
    const field = durationField({
      defaultValue: 'auto',
      allowedValues: ['auto', '4', '5'],
    });

    expect(normalizeShotVideoTakeParameterValues({
      fields: [field],
      values: { duration: 'auto' },
    })).toEqual({ duration: '4' });
    expect(normalizeShotVideoTakeParameterValues({
      fields: [field],
      values: { duration: '5' },
    })).toEqual({ duration: '5' });
  });

  it('resets a duration that is not supported by the selected model', () => {
    const field = durationField({
      defaultValue: 'auto',
      allowedValues: ['auto', '4', '6', '8'],
    });

    expect(normalizeShotVideoTakeParameterValues({
      fields: [field],
      values: { duration: '5' },
    })).toEqual({ duration: '4' });
  });

  it('leaves an invalid authored value available to normal schema validation', () => {
    const field = durationField({
      defaultValue: 'auto',
      allowedValues: ['auto', '4', '5'],
    });

    expect(normalizeShotVideoTakeParameterValues({
      fields: [field],
      values: { duration: 'not-a-duration' },
    })).toEqual({ duration: 'not-a-duration' });
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
