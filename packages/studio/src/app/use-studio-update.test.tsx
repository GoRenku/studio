// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '@/ui/button';
import { useStudioUpdate } from './use-studio-update';

const readStatus = vi.hoisted(() => vi.fn());
const startUpdate = vi.hoisted(() => vi.fn());
vi.mock('@/services/studio-update-api', () => ({
  readStudioUpdateStatus: readStatus,
  startStudioUpdate: startUpdate,
}));

function Harness() {
  const update = useStudioUpdate();
  return <span>{update.status?.state ?? 'unknown'}</span>;
}

function NavigationHarness() {
  const update = useStudioUpdate();
  const [projectOpen, setProjectOpen] = React.useState(false);
  return <>
    <Button type='button' onClick={() => setProjectOpen(!projectOpen)}>Navigate</Button>
    <span>{projectOpen ? 'Movie Studio' : 'Project Library'}</span>
    <span>{update.status?.state ?? 'unknown'}</span>
  </>;
}

function ConfirmationHarness() {
  const update = useStudioUpdate();
  return <>
    <Button type='button' onClick={() => void update.confirm()}>Confirm</Button>
    <span>{update.status?.state ?? 'unknown'}</span>
    <span>{update.handoff}</span>
    {update.error ? <span>{update.error}</span> : null}
  </>;
}

describe('Studio update scheduling', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    readStatus.mockReset();
    startUpdate.mockReset();
  });

  it('checks at mount and again six hours later while mounted', async () => {
    vi.useFakeTimers();
    readStatus.mockResolvedValue({ state: 'current', installedVersion: '0.0.1', publishedVersion: '0.0.1' });
    render(<Harness />);
    await act(async () => { await Promise.resolve(); });
    expect(readStatus).toHaveBeenCalledTimes(1);
    expect(screen.getByText('current')).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000); });
    expect(readStatus).toHaveBeenCalledTimes(2);
    expect(startUpdate).not.toHaveBeenCalled();
  });

  it('keeps a confirmed offer through a temporary failed check', async () => {
    vi.useFakeTimers();
    readStatus.mockResolvedValueOnce({ state: 'available', installedVersion: '0.0.1', publishedVersion: '0.0.2' })
      .mockRejectedValueOnce(new Error('offline'));
    render(<Harness />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000); });
    expect(screen.getByText('available')).toBeTruthy();
    expect(startUpdate).not.toHaveBeenCalled();
  });

  it('keeps one confirmed offer and timer across navigation', async () => {
    vi.useFakeTimers();
    readStatus.mockResolvedValue({ state: 'available', installedVersion: '0.0.1', publishedVersion: '0.0.2' });
    render(<NavigationHarness />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole('button', { name: 'Navigate' }));
    expect(screen.getByText('Movie Studio')).toBeTruthy();
    expect(screen.getByText('available')).toBeTruthy();
    expect(readStatus).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000); });
    expect(readStatus).toHaveBeenCalledTimes(2);
  });

  it('shows a failed handoff without claiming the release is current', async () => {
    readStatus.mockResolvedValue({ state: 'available', installedVersion: '0.0.1', publishedVersion: '0.0.2' });
    startUpdate.mockRejectedValue(new Error('Terminal unavailable.'));
    render(<ConfirmationHarness />);
    expect(await screen.findByText('available')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('Terminal unavailable.')).toBeTruthy();
    expect(screen.getByText('idle')).toBeTruthy();
    expect(readStatus).toHaveBeenCalledTimes(1);
  });
});
