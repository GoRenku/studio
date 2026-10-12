// @vitest-environment jsdom
import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { NativeRequestControls } from '@gorenku/studio-codex/native-request-controls';
import type { JsonValue } from '@gorenku/studio-core/client';
import { initialNativeRequestValues } from './native-request-values';
import { PanelNativeControls } from './panel-native-controls';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
afterEach(cleanup);

const options = (values: string[]) => values.map((value) => ({ value, label: value.toUpperCase() }));

const controls: NativeRequestControls = { groups: [{ label: 'Output', fields: [
  { key: '/warmth', label: 'Warmth', kind: 'number', minimum: 0, maximum: 1, initialValue: 0.5 },
  { key: '/steps', label: 'Steps', kind: 'integer', initialValue: 20 },
  { key: '/size', label: 'Size', kind: 'enum', options: options(['s', 'm', 'l']), initialValue: 'm' },
  { key: '/style', label: 'Style', kind: 'enum', options: options(['a', 'b', 'c', 'd', 'e', 'f']), initialValue: 'a' },
  { key: '/boost', label: 'Boost', kind: 'boolean', initialValue: false },
  { key: '/tone', label: 'Tone', kind: 'text', initialValue: 'calm' },
] }] };

function EditableControls({ definition = controls }: { definition?: NativeRequestControls }) {
  const [values, setValues] = useState<Record<string, JsonValue>>(() => initialNativeRequestValues(definition));
  return <>
    <PanelNativeControls controls={definition.groups[0]!.fields} values={values} disabled={false} onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))} />
    <output aria-label='Values'>{JSON.stringify(values)}</output>
  </>;
}

const currentValues = () => JSON.parse(screen.getByLabelText('Values').textContent!) as Record<string, JsonValue>;

describe('PanelNativeControls', () => {
  it('starts from every initial value', () => {
    render(<EditableControls />);
    expect(currentValues()).toEqual({ '/warmth': 0.5, '/steps': 20, '/size': 'm', '/style': 'a', '/boost': false, '/tone': 'calm' });
  });

  it('renders a bounded number as a slider with a native-value readout', () => {
    render(<EditableControls />);
    const slider = screen.getByRole('slider', { name: 'Warmth' });
    expect(slider.getAttribute('aria-valuemax')).toBe('1');
    expect(screen.getByText('0.50')).toBeTruthy();
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(currentValues()['/warmth']).toBeCloseTo(0.51);
    expect(screen.getByText('0.51')).toBeTruthy();
  });

  it('renders an unbounded integer as a number input', () => {
    render(<EditableControls />);
    const input = screen.getByRole('spinbutton', { name: 'Steps' });
    fireEvent.change(input, { target: { value: '30' } });
    expect(currentValues()['/steps']).toBe(20);
    fireEvent.blur(input);
    expect(currentValues()['/steps']).toBe(30);
  });

  it.each([{}, { minimum: 0 }, { maximum: 100 }])('allows delete-then-type replacement with bounds %j', (bounds) => {
    const definition: NativeRequestControls = { groups: [{ label: 'Output', fields: [
      { key: '/steps', label: 'Steps', kind: 'integer', initialValue: 20, ...bounds },
    ] }] };
    render(<EditableControls definition={definition} />);
    const input = screen.getByRole('spinbutton', { name: 'Steps' });
    fireEvent.change(input, { target: { value: '' } });
    expect(input).toHaveProperty('value', '');
    expect(currentValues()['/steps']).toBe(20);
    fireEvent.change(input, { target: { value: '35' } });
    expect(input).toHaveProperty('value', '35');
    expect(currentValues()['/steps']).toBe(20);
    fireEvent.blur(input);
    expect(currentValues()['/steps']).toBe(35);
  });

  it('commits a negative number with Enter', () => {
    render(<EditableControls />);
    const input = screen.getByRole('spinbutton', { name: 'Steps' });
    input.focus();
    fireEvent.change(input, { target: { value: '-5' } });
    expect(currentValues()['/steps']).toBe(20);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(currentValues()['/steps']).toBe(-5);
  });

  it.each(['', '-', '1e', '1e999'])('restores the committed number when the draft %j is incomplete or non-finite', (draft) => {
    render(<EditableControls />);
    const input = screen.getByRole('spinbutton', { name: 'Steps' });
    fireEvent.change(input, { target: { value: draft } });
    expect(currentValues()['/steps']).toBe(20);
    fireEvent.blur(input);
    expect(input).toHaveProperty('value', '20');
    expect(currentValues()['/steps']).toBe(20);
  });

  it('updates a number input when its committed value changes externally', () => {
    const inputProps = { controls: controls.groups[0]!.fields, disabled: false, onChange: () => {} };
    const { rerender } = render(<PanelNativeControls {...inputProps} values={{ '/steps': 20 }} />);
    rerender(<PanelNativeControls {...inputProps} values={{ '/steps': 40 }} />);
    expect(screen.getByRole('spinbutton', { name: 'Steps' })).toHaveProperty('value', '40');
  });

  it.each([
    { step: 0.25, value: 0.25, readout: '0.25' },
    { step: 0.25, value: 0.75, readout: '0.75' },
    { step: 2.5, value: 7.5, readout: '7.5' },
    { step: 0.0025, value: 0.0075, readout: '0.0075' },
    { step: 1, value: 0.25, readout: '0.25' },
    { step: 0.1, value: 0.12345, readout: '0.12345' },
    { step: 2.5e-7, value: 7.5e-7, readout: '0.00000075' },
    { step: 1e-7, value: 3e-7, readout: '0.0000003' },
    { step: 1e-101, value: 3e-101, readout: '3e-101' },
  ])('displays $value accurately for a slider step of $step', ({ step, value, readout }) => {
    render(<PanelNativeControls controls={[
      { key: '/amount', label: 'Amount', kind: 'number', minimum: 0, maximum: 10, step },
    ]} values={{ '/amount': value }} disabled={false} onChange={() => {}} />);
    expect(screen.getByText(readout)).toBeTruthy();
  });

  it('renders a small enum as a segmented group and a large enum as a Select', () => {
    render(<EditableControls />);
    const size = screen.getByRole('group', { name: 'Size' });
    expect(within(size).getAllByRole('button').map((button) => button.textContent)).toEqual(['S', 'M', 'L']);
    fireEvent.click(within(size).getByRole('button', { name: 'L' }));
    expect(currentValues()['/size']).toBe('l');
    expect(within(size).getByRole('button', { name: 'L' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('combobox', { name: 'Style' })).toBeTruthy();
  });

  it('renders a boolean as a switch and text as an input', () => {
    render(<EditableControls />);
    fireEvent.click(screen.getByRole('switch', { name: 'Boost' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Tone' }), { target: { value: 'tense' } });
    expect(currentValues()).toMatchObject({ '/boost': true, '/tone': 'tense' });
  });
});
