import { describe, expect, it } from 'vitest';
import type { GenerationReviewField } from './client.js';
import { validateFieldValue, validateReviewControls } from './generation-review-contracts.js';

describe('Skill-authored presentation controls', () => {
  it('validates nested object and array types without interpreting creative text', () => {
    const field: GenerationReviewField = {
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
    const field: GenerationReviewField = { key: '/seed', label: 'Seed', kind: 'integer', nullable: true };
    expect(() => validateFieldValue(field, null)).not.toThrow();
    expect(() => validateFieldValue(field, undefined)).not.toThrow();
    expect(() => validateFieldValue({ ...field, required: true }, undefined)).toThrow();
    expect(() => validateFieldValue({ ...field, nullable: false }, null)).toThrow();
    expect(() => validateFieldValue(field, 1.2)).toThrow();
  });

  it('requires actual enum choices and bounds rather than inventing them', () => {
    expect(() => validateReviewControls({ groups: [{ label: 'Output', fields: [{ key: '/resolution', label: 'Resolution', kind: 'enum' }] }] })).toThrow();
    expect(() => validateReviewControls({ groups: [{ label: 'Output', fields: [{ key: '/size', label: 'Size', kind: 'number', minimum: 5, maximum: 1 }] }] })).toThrow();
    expect(() => validateFieldValue({ key: '/duration', label: 'Duration', kind: 'number' }, 999)).not.toThrow();
  });

  it('keeps unsafe transport values out of accepted settings', () => {
    const field: GenerationReviewField = { key: '/url', label: 'URL', kind: 'text' };
    expect(() => validateFieldValue(field, '/private/local.png')).toThrow(expect.objectContaining({ code: 'CORE_MEDIA_GENERATION_REVIEW_UNSAFE' }));
    expect(() => validateFieldValue(field, 'https://fal.media/temporary.png')).toThrow();
  });

  it('checks every choice before exposing controls, including choices that are not selected', () => {
    const field: GenerationReviewField = {
      key: '/reference', label: 'Reference', kind: 'enum', initialValue: 'prepared',
      options: [{ label: 'Prepared', value: 'prepared' }, { label: 'Uploaded', value: 'https://fal.media/temporary.png' }],
    };
    expect(() => validateReviewControls({ groups: [{ label: 'References', fields: [field] }] })).toThrow(expect.objectContaining({ code: 'CORE_MEDIA_GENERATION_REVIEW_UNSAFE' }));
    expect(() => validateReviewControls({ groups: [{ label: 'References', fields: [{ key: '/options', label: 'Options', kind: 'object', properties: [{ ...field, key: 'reference' }] }] }] })).toThrow();
  });

  it('accepts exact nested and escaped native pointers and rejects ambiguous field identities', () => {
    const field: GenerationReviewField = { key: '/output/image~1size', label: 'Image size', kind: 'text', initialValue: '2K' };
    expect(() => validateReviewControls({ groups: [{ label: 'Output', fields: [field] }] })).not.toThrow();
    expect(() => validateReviewControls({ groups: [{ label: 'Output', fields: [{ ...field, key: '/output/image~size' }] }] })).toThrow(expect.objectContaining({ code: 'CODEX_REVIEW_INVALID' }));
  });

  it('applies Core secret-field safety to native pointers and nested property choices before display', () => {
    const secret: GenerationReviewField = { key: '/options/api_key', label: 'Credential', kind: 'text' };
    expect(() => validateReviewControls({ groups: [{ label: 'Options', fields: [secret] }] })).toThrow(expect.objectContaining({ code: 'CORE_MEDIA_GENERATION_REVIEW_UNSAFE' }));
    expect(() => validateFieldValue(secret, 'not-a-real-key')).toThrow(expect.objectContaining({ code: 'CORE_MEDIA_GENERATION_REVIEW_UNSAFE' }));
    expect(() => validateReviewControls({ groups: [{ label: 'Options', fields: [{
      key: '/options', label: 'Options', kind: 'object', properties: [{
        key: 'authorization', label: 'Credential', kind: 'enum', options: [{ label: 'Test credential', value: 'not-a-real-key' }],
      }],
    }] }] })).toThrow(expect.objectContaining({ code: 'CORE_MEDIA_GENERATION_REVIEW_UNSAFE' }));
  });
});
