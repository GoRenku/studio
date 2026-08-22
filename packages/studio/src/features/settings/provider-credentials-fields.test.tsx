// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProviderCredentialsFields } from './provider-credentials-fields';

describe('ProviderCredentialsFields', () => {
  afterEach(cleanup);

  it('uses the field itself to distinguish configured and missing keys', () => {
    renderFields();

    expect(screen.getByText('fal.ai')).toBeTruthy();
    expect(screen.getByText('ElevenLabs')).toBeTruthy();
    expect(screen.getByText('World Labs')).toBeTruthy();
    expect(screen.getByLabelText('fal.ai')).toHaveProperty(
      'placeholder',
      '••••••••••••••••'
    );
    expect(screen.getByLabelText('ElevenLabs')).toHaveProperty(
      'placeholder',
      'Enter API key'
    );
    expect(screen.getByLabelText('World Labs')).toHaveProperty('disabled', false);
    expect(
      screen.getByRole('button', { name: 'Replace fal.ai API key' })
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Replace ElevenLabs API key' })
    ).toBeNull();
    expect(screen.queryByText('Saved')).toBeNull();
    expect(screen.queryByText('Remove saved key')).toBeNull();
  });

  it('makes configured-key replacement an explicit field action', () => {
    renderFields();

    const input = screen.getByLabelText('World Labs');
    fireEvent.click(
      screen.getByRole('button', { name: 'Replace World Labs API key' })
    );
    expect(document.activeElement).toBe(input);
  });

  it('reports typed values and reveals only the current draft', () => {
    const onValueChange = vi.fn();
    renderFields({
      draftValues: { 'fal-ai': 'new-test-secret' },
      onValueChange,
    });

    const input = screen.getByLabelText('fal.ai') as HTMLInputElement;
    expect(input.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Show API key' }));
    expect(input.type).toBe('text');
    expect(input.value).toBe('new-test-secret');
    fireEvent.change(input, { target: { value: 'replacement' } });
    expect(onValueChange).toHaveBeenCalledWith('fal-ai', 'replacement');
  });

  it('renders independently from Dialog chrome for onboarding reuse', () => {
    renderFields();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });
});

function renderFields(
  overrides: Partial<React.ComponentProps<typeof ProviderCredentialsFields>> = {}
) {
  return render(
    <ProviderCredentialsFields {...defaultProps()} {...overrides} />
  );
}

function defaultProps(): React.ComponentProps<typeof ProviderCredentialsFields> {
  return {
    providers: [
      {
        provider: 'fal-ai',
        label: 'fal.ai',
        configured: true,
      },
      {
        provider: 'elevenlabs',
        label: 'ElevenLabs',
        configured: false,
      },
      {
        provider: 'world-labs',
        label: 'World Labs',
        configured: true,
      },
    ],
    draftValues: {},
    onValueChange: vi.fn(),
  };
}
