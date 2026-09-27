// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudioUpdateNotice } from './studio-update-notice';
import type { StudioUpdateController } from './use-studio-update';

function update(): StudioUpdateController {
  return {
    status: { state: 'available', installedVersion: '0.0.1', publishedVersion: '0.0.2' },
    handoff: 'idle',
    error: null,
    confirm: vi.fn(async () => {}),
    clearError: vi.fn(),
  };
}

describe('Studio update notice', () => {
  afterEach(cleanup);

  it('is absent before a valid offer', () => {
    render(<StudioUpdateNotice update={{ ...update(), status: null }} />);
    expect(screen.queryByRole('button', { name: /update available/i })).toBeNull();
    render(<StudioUpdateNotice update={{ ...update(), status: { state: 'current', installedVersion: '0.0.2', publishedVersion: '0.0.2' } }} />);
    expect(screen.queryByRole('button', { name: /update available/i })).toBeNull();
  });

  it('opens details and leaves the offer after Not now without starting an update', () => {
    const controller = update();
    render(<StudioUpdateNotice update={controller} />);
    fireEvent.click(screen.getByRole('button', { name: /update available/i }));
    expect(screen.getByText('Version 0.0.2 is available')).toBeTruthy();
    expect(screen.getByText('Installed version: 0.0.1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.getByRole('button', { name: /update available/i })).toBeTruthy();
    expect(controller.confirm).not.toHaveBeenCalled();
  });

  it('starts only after confirmation', () => {
    const controller = update();
    render(<StudioUpdateNotice update={controller} />);
    fireEvent.click(screen.getByRole('button', { name: /update available/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Download and update' }));
    expect(controller.confirm).toHaveBeenCalledOnce();
  });
});
