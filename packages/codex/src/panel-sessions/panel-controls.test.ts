import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import { describe, expect, it } from 'vitest';
import { panelControlIssues } from './panel-controls.js';

const issue = (path: Array<string | number>, message: string) => createDiagnosticError('TEST_INVALID', message, { path: path.map(String) });

describe('panel control profile', () => {
  it('accepts scalar controls with initial values', () => {
    expect(panelControlIssues({ groups: [{ label: 'Voice', fields: [
      { key: '/settings/warmth', label: 'Warmth', kind: 'number', minimum: 0, maximum: 1, initialValue: 0.5 },
      { key: '/quality', label: 'Quality', kind: 'enum', options: [{ value: 'low', label: 'Low' }, { value: 'high', label: 'High' }], initialValue: 'high' },
      { key: '/boost', label: 'Boost', kind: 'boolean', initialValue: true },
    ] }] }, issue, ['route'])).toEqual([]);
  });

  it('rejects disallowed kinds, a missing initial value and nullable controls', () => {
    const issues = panelControlIssues({ groups: [{ label: 'Voice', fields: [
      { key: '/notes', label: 'Notes', kind: 'multiline', initialValue: '' },
      { key: '/seed', label: 'Seed', kind: 'integer' },
      { key: '/strength', label: 'Strength', kind: 'number', nullable: true, initialValue: 1 },
    ] }] }, issue, ['route', 'controls']);
    expect(issues.map((entry) => entry.location.path.join('.'))).toEqual([
      'route.controls.groups.0.fields.0.kind',
      'route.controls.groups.0.fields.1.initialValue',
      'route.controls.groups.0.fields.2.nullable',
    ]);
  });
});
