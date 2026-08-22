// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudioSidebarActions } from '@/features/movie-studio/studio-sidebar/studio-sidebar-actions';
import { StudioAppHeader } from './studio-app-header';

vi.mock('@/features/settings/app-settings-dialog', () => ({
  AppSettingsDialog: () => <span data-testid='settings-entry'>Settings</span>,
}));

vi.mock('@/ui/theme-toggle', () => ({
  ThemeToggle: () => <span data-testid='theme-entry'>Theme</span>,
}));

describe('global Settings entry points', () => {
  afterEach(cleanup);

  it('places Settings immediately before ThemeToggle in the Project Library header', () => {
    render(<StudioAppHeader subtitle='Project Library' />);
    expect(settingsPrecedesTheme()).toBe(true);
  });

  it('places Settings immediately before ThemeToggle in Movie Studio', () => {
    render(<StudioSidebarActions />);
    expect(settingsPrecedesTheme()).toBe(true);
  });
});

function settingsPrecedesTheme(): boolean {
  const settings = screen.getByTestId('settings-entry');
  const theme = screen.getByTestId('theme-entry');
  return Boolean(
    settings.parentElement === theme.parentElement &&
      settings.nextElementSibling === theme
  );
}
