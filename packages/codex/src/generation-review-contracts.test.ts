import { describe, expect, it } from 'vitest';
import { validateReviewControls } from './generation-review-contracts.js';

describe('generation review controls', () => {
  it('reports every invalid control in one CODEX_REVIEW_INVALID', () => {
    let failure: unknown;
    try {
      validateReviewControls({ groups: [{ label: 'Output', fields: [
        { key: '/resolution', label: 'Resolution', kind: 'enum' },
        { key: '/size', label: 'Size', kind: 'number', minimum: 5, maximum: 1 },
        { key: '/output/image~size', label: 'Image size', kind: 'text' },
      ] }] });
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({ code: 'CODEX_REVIEW_INVALID' });
    expect((failure as { issues: Array<{ location: { path: string[] } }> }).issues.map((issue) => issue.location.path.join('.'))).toEqual([
      'controls.groups.0.fields.0.options',
      'controls.groups.0.fields.1',
      'controls.groups.0.fields.2.key',
    ]);
  });
});
