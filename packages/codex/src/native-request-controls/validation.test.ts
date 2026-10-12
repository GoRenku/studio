import type { JsonValue } from '@gorenku/studio-core/client';
import { createDiagnosticError, StructuredError } from '@gorenku/studio-diagnostics';
import { describe, expect, it } from 'vitest';
import type { NativeRequestControl, NativeRequestControls } from './contracts.js';
import { readJsonPointer } from './json-pointer.js';
import { nativeRequestControlIssues, nativeRequestValueIssues } from './validation.js';

const issue = (path: Array<string | number>, message: string) => createDiagnosticError('TEST_INVALID', message, { path: path.map(String) });

function assertValid(issues: ReturnType<typeof issue>[]): void {
  if (issues.length > 0) throw new StructuredError({ code: 'TEST_INVALID', message: 'invalid', issues });
}

function validateFieldValue(control: NativeRequestControl, value: JsonValue | undefined): void {
  assertValid(nativeRequestValueIssues(control, value, issue, ['value']));
}

function validateControls(controls: NativeRequestControls): void {
  assertValid(nativeRequestControlIssues(controls, issue));
}

describe('Native Request Controls', () => {
  it('validates nested object and array types without interpreting creative text', () => {
    const field: NativeRequestControl = {
      key: '/options', label: 'Options', kind: 'object', properties: [
        { key: 'enabled', label: 'Enabled', kind: 'boolean', required: true },
        { key: 'weights', label: 'Weights', kind: 'array', element: { key: 'weight', label: 'Weight', kind: 'number', minimum: 0, maximum: 1 } },
        { key: 'instruction', label: 'Instruction', kind: 'multiline' },
      ],
    };
    expect(() => validateFieldValue(field, { enabled: false, weights: [0.2, 1], instruction: 'α\nNo particular template or tokens.' })).not.toThrow();
    expect(() => validateFieldValue(field, { enabled: 'false' })).toThrow();
    expect(() => validateFieldValue(field, { enabled: true, weights: [1.5] })).toThrow();
    expect(() => validateFieldValue(field, { enabled: true, undeclared: false })).toThrow();
  });

  it('preserves nullable and absent values only where declared', () => {
    const field: NativeRequestControl = { key: '/seed', label: 'Seed', kind: 'integer', nullable: true };
    expect(() => validateFieldValue(field, null)).not.toThrow();
    expect(() => validateFieldValue(field, undefined)).not.toThrow();
    expect(() => validateFieldValue({ ...field, required: true }, undefined)).toThrow();
    expect(() => validateFieldValue({ ...field, nullable: false }, null)).toThrow();
    expect(() => validateFieldValue(field, 1.2)).toThrow();
  });

  it('requires actual enum choices and bounds rather than inventing them', () => {
    expect(() => validateControls({ groups: [{ label: 'Output', fields: [{ key: '/resolution', label: 'Resolution', kind: 'enum' }] }] })).toThrow();
    expect(() => validateControls({ groups: [{ label: 'Output', fields: [{ key: '/size', label: 'Size', kind: 'number', minimum: 5, maximum: 1 }] }] })).toThrow();
    expect(() => validateFieldValue({ key: '/duration', label: 'Duration', kind: 'number' }, 999)).not.toThrow();
  });

  it('keeps unsafe transport values out of accepted settings', () => {
    const field: NativeRequestControl = { key: '/url', label: 'URL', kind: 'text' };
    expect(() => validateFieldValue(field, '/private/local.png')).toThrow(expect.objectContaining({ code: 'CORE_MEDIA_GENERATION_REVIEW_UNSAFE' }));
    expect(() => validateFieldValue(field, 'https://fal.media/temporary.png')).toThrow();
  });

  it('checks every choice before exposing controls, including choices that are not selected', () => {
    const field: NativeRequestControl = {
      key: '/reference', label: 'Reference', kind: 'enum', initialValue: 'prepared',
      options: [{ label: 'Prepared', value: 'prepared' }, { label: 'Uploaded', value: 'https://fal.media/temporary.png' }],
    };
    expect(() => validateControls({ groups: [{ label: 'References', fields: [field] }] })).toThrow(expect.objectContaining({ code: 'CORE_MEDIA_GENERATION_REVIEW_UNSAFE' }));
    expect(() => validateControls({ groups: [{ label: 'References', fields: [{ key: '/options', label: 'Options', kind: 'object', properties: [{ ...field, key: 'reference' }] }] }] })).toThrow();
  });

  it('accepts exact nested and escaped native pointers and rejects ambiguous field identities', () => {
    const field: NativeRequestControl = { key: '/output/image~1size', label: 'Image size', kind: 'text', initialValue: '2K' };
    expect(() => validateControls({ groups: [{ label: 'Output', fields: [field] }] })).not.toThrow();
    expect(() => validateControls({ groups: [{ label: 'Output', fields: [{ ...field, key: '/output/image~size' }] }] })).toThrow(expect.objectContaining({ code: 'TEST_INVALID' }));
  });

  it('applies Core secret-field safety to native pointers and nested property choices before display', () => {
    const secret: NativeRequestControl = { key: '/options/api_key', label: 'Credential', kind: 'text' };
    expect(() => validateControls({ groups: [{ label: 'Options', fields: [secret] }] })).toThrow(expect.objectContaining({ code: 'CORE_MEDIA_GENERATION_REVIEW_UNSAFE' }));
    expect(() => validateFieldValue(secret, 'not-a-real-key')).toThrow(expect.objectContaining({ code: 'CORE_MEDIA_GENERATION_REVIEW_UNSAFE' }));
    expect(() => validateControls({ groups: [{ label: 'Options', fields: [{
      key: '/options', label: 'Options', kind: 'object', properties: [{
        key: 'authorization', label: 'Credential', kind: 'enum', options: [{ label: 'Test credential', value: 'not-a-real-key' }],
      }],
    }] }] })).toThrow(expect.objectContaining({ code: 'CORE_MEDIA_GENERATION_REVIEW_UNSAFE' }));
  });

  it('collects every structural issue with its location', () => {
    const issues = nativeRequestControlIssues({ groups: [{ label: 'Output', fields: [
      { key: 'resolution', label: 'Resolution', kind: 'text' },
      { key: '/size', label: 'Size', kind: 'number', minimum: 5, maximum: 1 },
      { key: '/mode', label: 'Mode', kind: 'enum' },
      { key: '/size', label: 'Size again', kind: 'number', initialValue: 'large' },
    ] }] }, issue, ['controls']);
    expect(issues.map((entry) => entry.location.path.join('.'))).toEqual([
      'controls.groups.0.fields.0.key',
      'controls.groups.0.fields.1',
      'controls.groups.0.fields.2.options',
      'controls.groups.0.fields.3.key',
      'controls.groups.0.fields.3.initialValue',
    ]);
  });

  it('reads exact JSON Pointers, including escaped segments and array indexes', () => {
    const request = { inputs: [{ text: 'a' }, { text: 'b' }], 'a/b': { '~c': 1 } };
    expect(readJsonPointer(request, '/inputs/1/text')).toBe('b');
    expect(readJsonPointer(request, '/a~1b/~0c')).toBe(1);
    expect(readJsonPointer(request, '/inputs/2/text')).toBeUndefined();
    expect(readJsonPointer(request, '/missing')).toBeUndefined();
  });
});
