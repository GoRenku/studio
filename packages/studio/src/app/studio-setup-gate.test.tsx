// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudioApiError } from '@/services/studio-api-errors';
import { StudioSetupGate } from './studio-setup-gate';

const readRenkuSetupMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/studio-setup-api', () => ({
  readRenkuSetup: readRenkuSetupMock,
}));

vi.mock('./configured-studio-app', () => ({
  ConfiguredStudioApp: () => <div>Configured Studio</div>,
}));

vi.mock('@/features/onboarding/onboarding-screen', () => ({
  OnboardingScreen: () => <div>First-run onboarding</div>,
}));

describe('StudioSetupGate', () => {
  afterEach(() => {
    cleanup();
    readRenkuSetupMock.mockReset();
  });

  it('mounts configured Studio only after setup is confirmed', async () => {
    readRenkuSetupMock.mockResolvedValue({
      status: 'configured',
      storageRoot: '/tmp/projects',
    });

    render(<StudioSetupGate />);

    expect(await screen.findByText('Configured Studio')).toBeTruthy();
    expect(screen.queryByText('First-run onboarding')).toBeNull();
  });

  it('shows invalid config as a blocking error and retries only the read', async () => {
    readRenkuSetupMock
      .mockRejectedValueOnce(
        new StudioApiError(
          'Renku config version is unsupported.',
          'CONFIG006',
          400,
          [],
          'Repair the existing config before continuing.'
        )
      )
      .mockResolvedValueOnce({
        status: 'configured',
        storageRoot: '/tmp/projects',
      });

    render(<StudioSetupGate />);

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Renku config version is unsupported.'
    );
    expect(screen.getByText('Repair the existing config before continuing.')).toBeTruthy();
    expect(screen.queryByText('Configured Studio')).toBeNull();
    expect(screen.queryByText('First-run onboarding')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(readRenkuSetupMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Configured Studio')).toBeTruthy();
  });
});
