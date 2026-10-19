// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StudioApiError } from '@/services/studio-api-errors';
import { OnboardingScreen } from './onboarding-screen';

const initializeRenkuSetupMock = vi.hoisted(() => vi.fn());
const readProviderCredentialsMock = vi.hoisted(() => vi.fn());
const updateProviderCredentialsMock = vi.hoisted(() => vi.fn());
const readTelemetryStatusMock = vi.hoisted(() => vi.fn());
const updateTelemetryChoiceMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/studio-setup-api', () => ({
  initializeRenkuSetup: initializeRenkuSetupMock,
}));

vi.mock('@/services/studio-provider-credentials-api', () => ({
  readProviderCredentials: readProviderCredentialsMock,
  updateProviderCredentials: updateProviderCredentialsMock,
}));

vi.mock('@/services/studio-telemetry-api', () => ({
  readTelemetryStatus: readTelemetryStatusMock,
  updateTelemetryChoice: updateTelemetryChoiceMock,
}));

describe('first-run onboarding', () => {
  beforeEach(() => {
    readTelemetryStatusMock.mockResolvedValue(telemetryStatus());
  });

  afterEach(() => {
    cleanup();
    initializeRenkuSetupMock.mockReset();
    readProviderCredentialsMock.mockReset();
    updateProviderCredentialsMock.mockReset();
    readTelemetryStatusMock.mockReset();
    updateTelemetryChoiceMock.mockReset();
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
    await continuePastUsageStatistics(onConfigured);
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
    await continuePastUsageStatistics(onConfigured);
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
    await continuePastUsageStatistics(onConfigured);
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
    await continuePastUsageStatistics(onConfigured);
  });

  it('asks about usage statistics last, with the switch off and the question hidden', async () => {
    const onConfigured = vi.fn();
    await reachUsageStatistics(onConfigured);

    const usageSwitch = screen.getByRole('switch', { name: 'Share usage statistics' });
    expect(usageSwitch.getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByText('Where did you hear about Renku?', { exact: false })).toBeNull();
    expect(screen.getByRole('link', { name: 'See every field Renku sends' }).getAttribute('href'))
      .toBe('https://gorenku.com/privacy#app-usage-statistics');
    expect(screen.getByText('Usage statistics')).toBeTruthy();
  });

  it('saves a changed choice before finishing', async () => {
    updateTelemetryChoiceMock.mockResolvedValue(telemetryStatus({ enabled: true, installId: 'install-id' }));
    const onConfigured = vi.fn();
    await reachUsageStatistics(onConfigured);

    fireEvent.click(screen.getByRole('switch', { name: 'Share usage statistics' }));
    expect(screen.getByLabelText('Where did you hear about Renku?', { exact: false })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(updateTelemetryChoiceMock).toHaveBeenCalledWith({ enabled: true }));
    expect(onConfigured).toHaveBeenCalledWith('/Users/alex/Movies/Renku');
  });

  it('says why nothing is sent when an environment switch blocks sending', async () => {
    readTelemetryStatusMock.mockResolvedValue(telemetryStatus({ blockedBy: 'DO_NOT_TRACK' }));
    await reachUsageStatistics(vi.fn());

    expect(screen.queryByText('Nothing is sent while DO_NOT_TRACK is set on this computer.')).toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: 'Share usage statistics' }));
    expect(screen.getByText('Nothing is sent while DO_NOT_TRACK is set on this computer.')).toBeTruthy();
  });

  it('keeps the usage statistics step open when saving fails', async () => {
    updateTelemetryChoiceMock.mockRejectedValue(new Error('Usage statistics could not be saved.'));
    const onConfigured = vi.fn();
    await reachUsageStatistics(onConfigured);

    fireEvent.click(screen.getByRole('switch', { name: 'Share usage statistics' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Usage statistics could not be saved.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Help improve Renku' })).toBeTruthy();
    expect(onConfigured).not.toHaveBeenCalled();
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

async function reachUsageStatistics(onConfigured: (storageRoot: string) => void) {
  initializeRenkuSetupMock.mockResolvedValue({
    status: 'created',
    setup: { status: 'configured', storageRoot: '/Users/alex/Movies/Renku' },
  });
  readProviderCredentialsMock.mockResolvedValue(providerResource());
  renderOnboarding(onConfigured);
  fireEvent.click(screen.getByRole('button', { name: 'Use this Project Library' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Skip for now' }));
  await screen.findByRole('heading', { name: 'Help improve Renku' });
  await waitFor(() => expect(readTelemetryStatusMock).toHaveBeenCalled());
  await waitFor(() =>
    expect(screen.getByRole('switch', { name: 'Share usage statistics' }).hasAttribute('disabled')).toBe(false)
  );
}

/** Finishes setup from the last step without changing the usage statistics choice. */
async function continuePastUsageStatistics(onConfigured: ReturnType<typeof vi.fn>) {
  await screen.findByRole('heading', { name: 'Help improve Renku' });
  expect(onConfigured).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(screen.getByRole('switch', { name: 'Share usage statistics' }).hasAttribute('disabled')).toBe(false)
  );
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(onConfigured).toHaveBeenCalledWith('/Users/alex/Movies/Renku');
  expect(updateTelemetryChoiceMock).not.toHaveBeenCalled();
}

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

function telemetryStatus(overrides: Partial<{ enabled: boolean; installId: string | null; blockedBy: 'DO_NOT_TRACK' | null }> = {}) {
  return { enabled: false, installId: null, blockedBy: null, debug: false, ...overrides };
}
