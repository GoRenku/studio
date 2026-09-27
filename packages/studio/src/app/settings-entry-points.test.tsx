// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudioSidebarActions } from '@/features/movie-studio/studio-sidebar/studio-sidebar-actions';
import { StudioAppHeader } from './studio-app-header';
import type { StudioUpdateController } from './use-studio-update';

vi.mock('@/features/settings/app-settings-dialog', () => ({
  AppSettingsDialog: () => <span data-testid='settings-entry'>Settings</span>,
}));

vi.mock('@/ui/theme-toggle', () => ({
  ThemeToggle: () => <span data-testid='theme-entry'>Theme</span>,
}));

describe('global Settings entry points', () => {
  afterEach(cleanup);

  it('places Settings immediately before ThemeToggle in the Project Library header', () => {
    render(<StudioAppHeader />);
    expect(settingsPrecedesTheme()).toBe(true);
  });

  it('places Settings immediately before ThemeToggle in Movie Studio', () => {
    render(<StudioSidebarActions />);
    expect(settingsPrecedesTheme()).toBe(true);
  });

  it('keeps Home and update details as separate actions', () => {
    const onHome = vi.fn();
    const update: StudioUpdateController = {
      status: { state: 'available', installedVersion: '0.0.1', publishedVersion: '0.0.2' },
      handoff: 'idle',
      error: null,
      confirm: vi.fn(async () => {}),
      clearError: vi.fn(),
    };
    render(<StudioAppHeader update={update} onHome={onHome} />);
    fireEvent.click(screen.getByRole('button', { name: /Update available: version/ }));
    expect(screen.getByText('Version 0.0.2 is available')).toBeTruthy();
    expect(onHome).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    fireEvent.click(screen.getByRole('button', { name: 'Go to Renku Studio home' }));
    expect(onHome).toHaveBeenCalledOnce();
  });
});

function settingsPrecedesTheme(): boolean {
  const settings = screen.getByTestId('settings-entry');
  const theme = screen.getByTestId('theme-entry');
  return Boolean(
    settings.parentElement?.parentElement === theme.parentElement &&
      settings.parentElement?.nextElementSibling === theme
  );
}
