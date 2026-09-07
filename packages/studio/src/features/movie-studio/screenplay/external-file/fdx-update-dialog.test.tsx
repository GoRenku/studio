// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { FdxUpdateDialog } from './fdx-update-dialog';
import type { useFdxUpdate } from './use-fdx-update';

afterEach(cleanup);

it('replaces the review action with a distinct confirmation control without carrying focus', async () => {
  const controller: ReturnType<typeof useFdxUpdate> = {
    status: { state: 'pending', exportPath: '/movie/screenplay/edit/script.fdx', acceptedSourceSha256: '0'.repeat(64), sourceSha256: 'a'.repeat(64) },
    folderActionLabel: 'Open in Finder', open: true, review: null, stale: false, busy: true, error: null,
    show: vi.fn(), dismiss: vi.fn(), apply: vi.fn(), check: vi.fn(), reviewLatest: vi.fn(), openFolder: vi.fn(),
  };
  const { rerender } = render(<FdxUpdateDialog controller={controller} />);
  const reviewButton = screen.getByRole('button', { name: 'Review latest export' });
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Later' })));
  rerender(<FdxUpdateDialog controller={{ ...controller, busy: false, review: {
    sourceSha256: 'a'.repeat(64), reviewFingerprint: 'b'.repeat(64), change: 'sourceOnly',
    beforeSceneCount: 1, afterSceneCount: 1, retainedSceneCount: 1, survivingSceneOrderChanged: false,
    openingChanged: false, removedOrReplacedScenes: [], newScenes: [], analysisNeedsRefresh: false, diagnostics: [],
  } }} />);
  const applyButton = screen.getByRole('button', { name: 'Update screenplay' });
  expect(applyButton).not.toBe(reviewButton);
  expect(reviewButton.isConnected).toBe(false);
  expect(document.activeElement).not.toBe(applyButton);
  expect(controller.apply).not.toHaveBeenCalled();
});
