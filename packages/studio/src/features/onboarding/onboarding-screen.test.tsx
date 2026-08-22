// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudioApiError } from '@/services/studio-api-errors';
import { OnboardingScreen } from './onboarding-screen';

const initializeRenkuSetupMock = vi.hoisted(() => vi.fn());
const readProviderCredentialsMock = vi.hoisted(() => vi.fn());
const updateProviderCredentialsMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/studio-setup-api', () => ({
  initializeRenkuSetup: initializeRenkuSetupMock,
}));

vi.mock('@/services/studio-provider-credentials-api', () => ({
  readProviderCredentials: readProviderCredentialsMock,
  updateProviderCredentials: updateProviderCredentialsMock,
}));

describe('first-run onboarding', () => {
  afterEach(() => {
    cleanup();
    initializeRenkuSetupMock.mockReset();
    readProviderCredentialsMock.mockReset();
    updateProviderCredentialsMock.mockReset();
  });

  it('shows a read-only recommended path and allows credential setup to be skipped', async () => {
    initializeRenkuSetupMock.mockResolvedValue({
      status: 'created',
      setup: {
        status: 'configured',
        storageRoot: '/Users/alex/Movies/Renku',
      },
    });
    readProviderCredentialsMock.mockResolvedValue(providerResource());
    const onConfigured = vi.fn();
    renderOnboarding(onConfigured);

    expect(screen.getByText('/Users/alex/Movies/Renku')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /browse|choose folder/i })).toBeNull();

    fireEvent.click(
      screen.getByRole('button', { name: 'Use this Project Library' })
    );

    expect(await screen.findByLabelText('fal.ai')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    expect(onConfigured).toHaveBeenCalledWith('/Users/alex/Movies/Renku');
    expect(updateProviderCredentialsMock).not.toHaveBeenCalled();
  });

  it('saves one staged provider key before continuing', async () => {
    initializeRenkuSetupMock.mockResolvedValue({
      status: 'created',
      setup: {
        status: 'configured',
        storageRoot: '/Users/alex/Movies/Renku',
      },
    });
    readProviderCredentialsMock.mockResolvedValue(providerResource());
    updateProviderCredentialsMock.mockResolvedValue({
      providers: providerResource().providers.map((provider) => ({
        ...provider,
        configured: provider.provider === 'fal-ai',
      })),
    });
    const onConfigured = vi.fn();
    renderOnboarding(onConfigured);

    fireEvent.click(
      screen.getByRole('button', { name: 'Use this Project Library' })
    );
    const input = await screen.findByLabelText('fal.ai');
    fireEvent.change(input, { target: { value: 'onboarding-test-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));

    await waitFor(() =>
      expect(updateProviderCredentialsMock).toHaveBeenCalledWith({
        changes: [
          { provider: 'fal-ai', value: 'onboarding-test-secret' },
        ],
      })
    );
    expect(onConfigured).toHaveBeenCalledWith('/Users/alex/Movies/Renku');
  });

  it('continues without writing when no provider key is staged', async () => {
    initializeRenkuSetupMock.mockResolvedValue({
      status: 'created',
      setup: {
        status: 'configured',
        storageRoot: '/Users/alex/Movies/Renku',
      },
    });
    readProviderCredentialsMock.mockResolvedValue(providerResource());
    const onConfigured = vi.fn();
    renderOnboarding(onConfigured);

    fireEvent.click(
      screen.getByRole('button', { name: 'Use this Project Library' })
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));

    expect(updateProviderCredentialsMock).not.toHaveBeenCalled();
    expect(onConfigured).toHaveBeenCalledWith('/Users/alex/Movies/Renku');
  });

  it('retains a provider draft after save failure and still allows skip', async () => {
    initializeRenkuSetupMock.mockResolvedValue({
      status: 'created',
      setup: {
        status: 'configured',
        storageRoot: '/Users/alex/Movies/Renku',
      },
    });
    readProviderCredentialsMock.mockResolvedValue(providerResource());
    updateProviderCredentialsMock.mockRejectedValue(
      new Error('Provider API keys could not be saved.')
    );
    const onConfigured = vi.fn();
    renderOnboarding(onConfigured);

    fireEvent.click(
      screen.getByRole('button', { name: 'Use this Project Library' })
    );
    const input = await screen.findByLabelText('fal.ai');
    fireEvent.change(input, { target: { value: 'retained-test-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));

    expect(await screen.findByText('Provider API keys could not be saved.')).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe('retained-test-secret');
    expect(onConfigured).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    expect(onConfigured).toHaveBeenCalledWith('/Users/alex/Movies/Renku');
  });

  it('keeps the Project Library step available after initialization failure', async () => {
    initializeRenkuSetupMock.mockRejectedValue(
      new StudioApiError(
        'Project Library could not be created.',
        'CONFIG015',
        500,
        [],
        'Check the parent directory permissions, then try again.'
      )
    );
    renderOnboarding(vi.fn());

    fireEvent.click(
      screen.getByRole('button', { name: 'Use this Project Library' })
    );

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Project Library could not be created.'
    );
    expect(screen.getByText('Check the parent directory permissions, then try again.')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Use this Project Library' })
    ).toBeTruthy();
    expect(readProviderCredentialsMock).not.toHaveBeenCalled();
  });
});

function renderOnboarding(onConfigured: (storageRoot: string) => void) {
  return render(
    <OnboardingScreen
      setup={{
        status: 'setupRequired',
        recommendedStorageRoot: '/Users/alex/Movies/Renku',
      }}
      onConfigured={onConfigured}
    />
  );
}

function providerResource() {
  return {
    providers: [
      { provider: 'fal-ai', label: 'fal.ai', configured: false },
      { provider: 'elevenlabs', label: 'ElevenLabs', configured: false },
      { provider: 'world-labs', label: 'World Labs', configured: false },
    ],
  };
}
