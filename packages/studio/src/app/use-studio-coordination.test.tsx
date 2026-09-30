// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useStudioCoordination } from './use-studio-coordination';
import type { ProjectSession } from './use-project-session';

const api = vi.hoisted(() => ({
  readStudioEvents: vi.fn(), readStudioCurrent: vi.fn(), reportBrowserSessionActive: vi.fn(),
  reportStudioFocusChanged: vi.fn(), reportStudioFocusRequestFailed: vi.fn(), validateStudioFocusRequest: vi.fn(),
}));
vi.mock('@/services/studio-events-api', () => api);

function Harness({ loading = false }: { loading?: boolean }) {
  const selection = React.useMemo(() => ({ type: 'projectInformation' as const }), []);
  const projectSession = React.useMemo(() => ({
    isLoadingProjectRoute: loading,
    project: loading ? null : { project: { id: 'project_one', projectName: 'movie' }, storageRoot: '/movies' },
  }) as ProjectSession, [loading]);
  useStudioCoordination({ projectSession, studioSelection: { selection } });
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  api.readStudioEvents.mockResolvedValue({ events: [], nextCursor: '0' });
  api.readStudioCurrent.mockResolvedValue({ pendingRequest: null });
  api.reportBrowserSessionActive.mockResolvedValue(undefined);
  api.reportStudioFocusChanged.mockResolvedValue(undefined);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  vi.spyOn(document, 'hasFocus').mockReturnValue(false);
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

it('keeps the selected hidden tab live while the user works in another application', async () => {
  render(<Harness />);
  await act(async () => { await vi.advanceTimersByTimeAsync(180_000); });
  expect(api.reportBrowserSessionActive).toHaveBeenCalledTimes(4);
  for (const [report] of api.reportBrowserSessionActive.mock.calls) {
    expect(report).toMatchObject({ activityKind: 'heartbeat',
      projectRef: { id: 'project_one' }, focus: { screen: 'movieStudio', selection: { type: 'projectInformation' } } });
  }
  expect(api.reportStudioFocusChanged).toHaveBeenCalledTimes(1);
});

it('does not report project library during route loading and reports the resolved view immediately', async () => {
  const view = render(<Harness loading />);
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  expect(api.reportBrowserSessionActive).not.toHaveBeenCalled();
  expect(api.reportStudioFocusChanged).not.toHaveBeenCalled();
  view.rerender(<Harness />);
  await act(async () => {});
  expect(api.reportStudioFocusChanged).toHaveBeenCalledWith(expect.objectContaining({
    projectRef: { id: 'project_one', name: 'movie', storageRoot: '/movies' },
    focus: { screen: 'movieStudio', selection: { type: 'projectInformation' } },
  }));
});
