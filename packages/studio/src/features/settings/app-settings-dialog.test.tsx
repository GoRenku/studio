// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppSettingsDialog } from './app-settings-dialog';

const readProviderCredentialsMock = vi.hoisted(() => vi.fn());
const updateProviderCredentialsMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/studio-provider-credentials-api', () => ({
  readProviderCredentials: readProviderCredentialsMock,
  updateProviderCredentials: updateProviderCredentialsMock,
}));

vi.mock('sonner', () => ({
  toast: { success: toastSuccessMock },
}));

describe('AppSettingsDialog', () => {
  afterEach(() => {
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
