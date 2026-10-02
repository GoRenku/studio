// @vitest-environment jsdom
import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { JsonValue } from '@gorenku/studio-core/client';
import type { GenerationReviewControls } from '@gorenku/studio-codex/client';
import { GenerationReviewConfiguration } from './generation-review-controls';

afterEach(cleanup);

function EditableConfiguration({ controls, initial }: { controls: GenerationReviewControls; initial: Record<string, JsonValue> }) {
  const [values, setValues] = useState(initial);
  return <>
    <GenerationReviewConfiguration controls={controls} values={values} disabled={false} onChange={(key, value) => setValues((current) => {
      const next = { ...current };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return next;
    })} />
    <output aria-label='Accepted native values'>{JSON.stringify(values)}</output>
  </>;
}

describe('Skill-authored native configuration controls', () => {
  it('edits exact Unicode text, explicit numeric bounds, booleans and nested properties', () => {
    render(<EditableConfiguration controls={{ groups: [{ label: 'Native settings', fields: [
      { key: '/description', label: 'Description', kind: 'multiline', required: true },
      { key: '/duration', label: 'Duration', kind: 'number', minimum: 1, maximum: 10, step: 0.5, required: true },
      { key: '/audio', label: 'Audio', kind: 'boolean', required: true },
      { key: '/output', label: 'Output', kind: 'object', required: true, properties: [{ key: 'width', label: 'Width', kind: 'integer', required: true }] },
    ] }] }} initial={{ '/description': 'Initial', '/duration': 2, '/audio': false, '/output': { width: 1024 } }} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), { target: { value: 'Étude\nα and @Image1' } });
    const duration = screen.getByRole('spinbutton', { name: 'Duration' });
    expect(duration.getAttribute('min')).toBe('1');
    expect(duration.getAttribute('max')).toBe('10');
    expect(duration.getAttribute('step')).toBe('0.5');
    fireEvent.change(duration, { target: { value: '3.5' } });
    fireEvent.click(screen.getByRole('switch', { name: 'Audio' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Width' }), { target: { value: '2048' } });
    expect(JSON.parse(screen.getByLabelText('Accepted native values').textContent!)).toEqual({ '/description': 'Étude\nα and @Image1', '/duration': 3.5, '/audio': true, '/output': { width: 2048 } });
  });

  it('retains array edits and visibly reflects explicit null and absent values', () => {
    render(<EditableConfiguration controls={{ groups: [{ label: 'Native settings', fields: [
      { key: '/weights', label: 'Weights', kind: 'array', nullable: true, element: { key: 'weight', label: 'Weight', kind: 'number' } },
    ] }] }} initial={{ '/weights': [1, 2] }} />);
    const weights = screen.getByRole('textbox', { name: 'Weights' }) as HTMLTextAreaElement;
    fireEvent.change(weights, { target: { value: '[2, 3]' } });
    expect(weights.value).toBe('[2, 3]');
    fireEvent.click(screen.getByRole('button', { name: 'Use null' }));
    expect(weights.value).toBe('null');
    expect(JSON.parse(screen.getByLabelText('Accepted native values').textContent!)).toEqual({ '/weights': null });
    expect(screen.queryByRole('button', { name: 'Unset' })).toBeNull();
    fireEvent.change(weights, { target: { value: '' } });
    expect(weights.value).toBe('');
    expect(JSON.parse(screen.getByLabelText('Accepted native values').textContent!)).toEqual({});
    fireEvent.change(weights, { target: { value: '[invalid' } });
    expect(screen.getByRole('alert').textContent).toContain('valid JSON array');
    expect(JSON.parse(screen.getByLabelText('Accepted native values').textContent!)).toEqual({ '/weights': '[invalid' });
  });

  it('uses only supplied choices and describes multi-enum options', () => {
    render(<EditableConfiguration controls={{ groups: [{ label: 'Formats', fields: [
      { key: '/formats', label: 'Formats', kind: 'multi-enum', required: true, options: [{ value: 'png', label: 'PNG', description: 'Lossless image' }, { value: 'webp', label: 'WebP' }] },
      { key: '/seed', label: 'Seed', kind: 'integer', required: true },
    ] }] }} initial={{ '/formats': ['png'], '/seed': 1 }} />);
    expect(screen.getByText('Lossless image')).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: 'Formats: WebP' }));
    expect(JSON.parse(screen.getByLabelText('Accepted native values').textContent!)['/formats']).toEqual(['png', 'webp']);
    const seed = screen.getByRole('spinbutton', { name: 'Seed' });
    expect(seed.hasAttribute('min')).toBe(false);
    expect(seed.hasAttribute('max')).toBe(false);
    expect(within(screen.getByRole('group', { name: 'Formats' })).queryByRole('slider')).toBeNull();
  });
});
