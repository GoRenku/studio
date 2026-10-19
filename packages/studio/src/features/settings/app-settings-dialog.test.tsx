// @vitest-environment jsdom
import React from 'react';
import type { TelemetryStatus } from '@gorenku/studio-core/client';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppSettingsDialog } from './app-settings-dialog';
import { Button } from '@/ui/button';

const readProviderCredentialsMock = vi.hoisted(() => vi.fn());
const updateProviderCredentialsMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const readTelemetryStatusMock = vi.hoisted(() => vi.fn());
const updateTelemetryChoiceMock = vi.hoisted(() => vi.fn());
const INSTALL_ID = '0b6f6c1e-8a7d-4f0e-9c55-2f1d1c7a9e10';

vi.mock('@/services/studio-provider-credentials-api', () => ({
  readProviderCredentials: readProviderCredentialsMock,
  updateProviderCredentials: updateProviderCredentialsMock,
}));

vi.mock('@/services/studio-telemetry-api', () => ({
  readTelemetryStatus: readTelemetryStatusMock,
  updateTelemetryChoice: updateTelemetryChoiceMock,
}));

vi.mock('sonner', () => ({
  toast: { success: toastSuccessMock },
}));

describe('AppSettingsDialog', () => {
  beforeAll(() => {
    // The usage statistics Switch measures itself inside a form.
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  beforeEach(() => {
    readTelemetryStatusMock.mockResolvedValue(telemetryStatus());
  });

  afterEach(() => {
    readTelemetryStatusMock.mockReset();
    updateTelemetryChoiceMock.mockReset();
    cleanup();
    window.history.replaceState(null, '', '/');
    readProviderCredentialsMock.mockReset();
    updateProviderCredentialsMock.mockReset();
    toastSuccessMock.mockReset();
  });

  it('loads the exact provider list and saves one explicit draft', async () => {
    window.history.replaceState(null, '', '/?settings=provider-credentials');
    readProviderCredentialsMock.mockResolvedValue(resource());
    updateProviderCredentialsMock.mockResolvedValue({
      providers: resource().providers.map((provider) =>
        provider.provider === 'elevenlabs'
          ? { ...provider, configured: true }
          : provider
      ),
    });
    render(<AppSettingsDialog />);

    expect(await screen.findByText('fal.ai')).toBeTruthy();
    expect(
      screen.queryByRole('heading', { name: 'API Keys' })
    ).toBeNull();
    expect(screen.getByText('fal.ai')).toBeTruthy();
    expect(screen.getByText('ElevenLabs')).toBeTruthy();
    expect(screen.getByText('World Labs')).toBeTruthy();
    const save = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('ElevenLabs'), {
      target: { value: 'new-elevenlabs-test-secret' },
    });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);

    await waitFor(() =>
      expect(updateProviderCredentialsMock).toHaveBeenCalledWith({
        changes: [
          {
            provider: 'elevenlabs',
            value: 'new-elevenlabs-test-secret',
          },
        ],
      })
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.location.pathname + window.location.search).toBe('/');
    expect(toastSuccessMock).toHaveBeenCalledWith('Settings saved.');
  });

  it('turns usage statistics off on Save without touching provider keys', async () => {
    window.history.replaceState(null, '', '/?settings=provider-credentials');
    readProviderCredentialsMock.mockResolvedValue(resource());
    readTelemetryStatusMock.mockResolvedValue(telemetryStatus({ enabled: true }));
    updateTelemetryChoiceMock.mockResolvedValue(telemetryStatus());
    render(<AppSettingsDialog />);

    const usageSwitch = await screen.findByRole('switch', { name: 'Share usage statistics' });
    await waitFor(() => expect(usageSwitch.getAttribute('aria-checked')).toBe('true'));
    expect(screen.queryByText('Where did you hear about Renku?', { exact: false })).toBeNull();
    const save = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    fireEvent.click(usageSwitch);
    expect(save.disabled).toBe(false);
    fireEvent.click(save);

    await waitFor(() => expect(updateTelemetryChoiceMock).toHaveBeenCalledWith({ enabled: false }));
    expect(updateProviderCredentialsMock).not.toHaveBeenCalled();
    expect(toastSuccessMock).toHaveBeenCalledWith('Settings saved.');
  });

  it('shows why nothing is sent while statistics are on and blocked', async () => {
    window.history.replaceState(null, '', '/?settings=provider-credentials');
    readProviderCredentialsMock.mockResolvedValue(resource());
    readTelemetryStatusMock.mockResolvedValue(telemetryStatus({ enabled: true, blockedBy: 'CI' }));
    render(<AppSettingsDialog />);

    expect(await screen.findByText('Nothing is sent while Renku runs in CI.')).toBeTruthy();
  });

  it('disables provider controls and dismissal throughout a telemetry save', async () => {
    const pending = deferred<TelemetryStatus>();
    readProviderCredentialsMock.mockResolvedValue(resource());
    updateTelemetryChoiceMock.mockReturnValue(pending.promise);
    render(<AppSettingsDialog />);

    openDialog();
    await screen.findByLabelText('ElevenLabs');
    const usageSwitch = screen.getByRole('switch', { name: 'Share usage statistics' });
    await waitFor(() => expect(usageSwitch).toHaveProperty('disabled', false));
    fireEvent.click(usageSwitch);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    for (const provider of resource().providers) {
      expect(screen.getByLabelText(provider.label)).toHaveProperty('disabled', true);
    }
    expect(screen.getByRole('button', { name: 'Replace fal.ai API key' })).toHaveProperty('disabled', true);
    expect(usageSwitch).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveProperty('disabled', true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeTruthy();

    pending.resolve(telemetryStatus({ enabled: true }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(updateProviderCredentialsMock).not.toHaveBeenCalled();
    expect(updateTelemetryChoiceMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the saved install ID and deletion instructions visible through an opt-out draft', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    readProviderCredentialsMock.mockResolvedValue(resource());
    readTelemetryStatusMock.mockResolvedValue(telemetryStatus({ enabled: true }));
    render(<AppSettingsDialog />);

    openDialog();
    const installId = await screen.findByRole('textbox', { name: 'Install ID' });
    expect(installId).toHaveProperty('readOnly', true);
    expect(installId).toHaveProperty('value', INSTALL_ID);
    expect(screen.getByText(/To have statistics already sent deleted/).textContent)
      .toContain('support@codingventures.com with this ID before you turn statistics off.');
    expect(screen.getByText(/Turning off removes the ID from this computer/)).toBeTruthy();

    fireEvent.click(screen.getByRole('switch', { name: 'Share usage statistics' }));
    expect(installId).toHaveProperty('value', INSTALL_ID);
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await screen.findByRole('button', { name: 'Copied' });
    expect(writeText).toHaveBeenCalledWith(INSTALL_ID);
  });

  it('keeps the install ID selectable when clipboard access fails', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    readProviderCredentialsMock.mockResolvedValue(resource());
    readTelemetryStatusMock.mockResolvedValue(telemetryStatus({ enabled: true }));
    render(<AppSettingsDialog />);

    openDialog();
    fireEvent.click(await screen.findByRole('button', { name: 'Copy' }));
    expect((await screen.findByRole('alert')).textContent)
      .toBe('Unable to copy. Select the ID and copy it manually.');
    expect(screen.getByRole('textbox', { name: 'Install ID' })).toHaveProperty('value', INSTALL_ID);
  });

  it('shows no saved install ID or deletion instructions for an opt-in draft', async () => {
    readProviderCredentialsMock.mockResolvedValue(resource());
    render(<AppSettingsDialog />);

    openDialog();
    await screen.findByLabelText('ElevenLabs');
    const usageSwitch = screen.getByRole('switch', { name: 'Share usage statistics' });
    await waitFor(() => expect(usageSwitch).toHaveProperty('disabled', false));
    fireEvent.click(usageSwitch);

    expect(screen.queryByRole('textbox', { name: 'Install ID' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull();
    expect(screen.queryByText(/To have statistics already sent deleted/)).toBeNull();
  });

  it.each(['/', '/projects/urban-basilica?scene=scene-1'])(
    'opens the Settings link at %s and preserves other route state on Cancel',
    async (route) => {
      window.history.replaceState(null, '', `${route}${route.includes('?') ? '&' : '?'}settings=provider-credentials`);
      readProviderCredentialsMock.mockResolvedValue(resource());
      render(<AppSettingsDialog />);

      expect(await screen.findByLabelText('ElevenLabs')).toBeTruthy();
      expect(readProviderCredentialsMock).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(window.location.pathname + window.location.search).toBe(route);
    }
  );

  it('loads a Settings deep link once in StrictMode and keeps the key draft', async () => {
    window.history.replaceState(null, '', '/?settings=provider-credentials');
    const pending = deferred<ReturnType<typeof resource>>();
    readProviderCredentialsMock.mockReturnValue(pending.promise);
    render(
      <React.StrictMode>
        <AppSettingsDialog />
      </React.StrictMode>
    );

    expect(readProviderCredentialsMock).toHaveBeenCalledTimes(1);
    pending.resolve(resource());
    const input = await screen.findByLabelText('ElevenLabs') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'keep-this-test-secret' } });

    expect(input.value).toBe('keep-this-test-secret');
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled)
      .toBe(false);
  });

  it('loads telemetry once in StrictMode and keeps an opt-out draft', async () => {
    window.history.replaceState(null, '', '/?settings=provider-credentials');
    const pending = deferred<TelemetryStatus>();
    readProviderCredentialsMock.mockResolvedValue(resource());
    readTelemetryStatusMock.mockReturnValue(pending.promise);
    render(
      <React.StrictMode>
        <AppSettingsDialog />
      </React.StrictMode>
    );

    expect(readTelemetryStatusMock).toHaveBeenCalledTimes(1);
    pending.resolve(telemetryStatus({ enabled: true }));
    const usageSwitch = await screen.findByRole('switch', { name: 'Share usage statistics' });
    await waitFor(() => expect(usageSwitch.getAttribute('aria-checked')).toBe('true'));
    fireEvent.click(usageSwitch);

    expect(usageSwitch.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', false);
  });

  it('opens only the header dialog for a deep link when a setup trigger is also mounted', async () => {
    window.history.replaceState(null, '', '/?settings=provider-credentials');
    readProviderCredentialsMock.mockResolvedValue(resource());
    render(<>
      <AppSettingsDialog />
      <AppSettingsDialog trigger={<Button>Add API keys</Button>} />
    </>);
    await screen.findByLabelText('ElevenLabs');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(readProviderCredentialsMock).toHaveBeenCalledOnce();
  });

  it('discards an unsaved draft on Cancel and reloads on reopen', async () => {
    readProviderCredentialsMock.mockResolvedValue(resource());
    render(<AppSettingsDialog />);

    openDialog();
    const input = await screen.findByLabelText('ElevenLabs');
    fireEvent.change(input, { target: { value: 'discard-this-test-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    openDialog();

    const reopened = await screen.findByLabelText('ElevenLabs');
    expect((reopened as HTMLInputElement).value).toBe('');
    expect(updateProviderCredentialsMock).not.toHaveBeenCalled();
    expect(readProviderCredentialsMock).toHaveBeenCalledTimes(2);
  });

  it('keeps a safe draft after Save failure', async () => {
    readProviderCredentialsMock.mockResolvedValue(resource());
    updateProviderCredentialsMock.mockRejectedValue(
      new Error('The credentials file could not be saved.')
    );
    render(<AppSettingsDialog />);

    openDialog();
    const input = await screen.findByLabelText('ElevenLabs');
    fireEvent.change(input, { target: { value: 'retained-test-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'The credentials file could not be saved.'
    );
    expect((screen.getByLabelText('ElevenLabs') as HTMLInputElement).value).toBe(
      'retained-test-secret'
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('keeps the configured state quiet and removes secret-management clutter', async () => {
    readProviderCredentialsMock.mockResolvedValue(resource());
    render(<AppSettingsDialog />);

    openDialog();
    expect(await screen.findByLabelText('fal.ai')).toHaveProperty(
      'placeholder',
      '••••••••••••••••'
    );
    expect(screen.queryByText('Saved')).toBeNull();
    expect(screen.queryByText('Remove saved key')).toBeNull();
    expect(screen.queryByText(/environment variables take priority/i)).toBeNull();
    expect(screen.queryByText(/settings apply to every/i)).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Replace fal.ai API key' })
    ).toBeTruthy();
  });

  it('focuses the first missing key and discards through the close control', async () => {
    readProviderCredentialsMock.mockResolvedValue(resource());
    render(<AppSettingsDialog />);

    openDialog();
    const input = await screen.findByLabelText('ElevenLabs');
    await waitFor(() => expect(document.activeElement).toBe(input));
    fireEvent.change(input, { target: { value: 'discard-on-close' } });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    openDialog();

    expect((await screen.findByLabelText('fal.ai') as HTMLInputElement).value)
      .toBe('');
    expect(updateProviderCredentialsMock).not.toHaveBeenCalled();
  });

  it('keeps initial focus on neutral dialog chrome when every key exists', async () => {
    readProviderCredentialsMock.mockResolvedValue({
      providers: resource().providers.map((provider) => ({
        ...provider,
        configured: true,
      })),
    });
    render(<AppSettingsDialog />);

    openDialog();
    await screen.findByLabelText('fal.ai');
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('dialog'))
    );
  });

  it('retries a failed load without enabling Save', async () => {
    readProviderCredentialsMock
      .mockRejectedValueOnce(new Error('The credentials file could not be read.'))
      .mockResolvedValueOnce(resource());
    render(<AppSettingsDialog />);

    openDialog();
    expect((await screen.findByRole('alert')).textContent).toContain(
      'The credentials file could not be read.'
    );
    expect(
      (screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByLabelText('fal.ai')).toBeTruthy();
    expect(readProviderCredentialsMock).toHaveBeenCalledTimes(2);
  });

  it('blocks duplicate submission and dismissal while Save is in flight', async () => {
    const pending = deferred<ReturnType<typeof resource>>();
    readProviderCredentialsMock.mockResolvedValue(resource());
    updateProviderCredentialsMock.mockReturnValue(pending.promise);
    render(<AppSettingsDialog />);

    openDialog();
    fireEvent.change(await screen.findByLabelText('ElevenLabs'), {
      target: { value: 'one-in-flight-test-secret' },
    });
    const save = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(save);
    fireEvent.click(save);
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(updateProviderCredentialsMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled)
      .toBe(true);

    pending.resolve(resource());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

function openDialog(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Open Settings' }));
}

function resource() {
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
  };
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve(value: T): void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function telemetryStatus(overrides: Partial<TelemetryStatus> = {}): TelemetryStatus {
  return { enabled: false, installId: overrides.enabled ? INSTALL_ID : null, blockedBy: null, debug: false, ...overrides };
}
