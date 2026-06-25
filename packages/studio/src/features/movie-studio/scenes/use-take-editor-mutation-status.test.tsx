// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '@/ui/button';
import { useTakeEditorMutationStatus } from './use-take-editor-mutation-status';

describe('useTakeEditorMutationStatus', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports saving, saved, and then idle for a successful immediate mutation', async () => {
    vi.useFakeTimers();
    render(
      <TakeEditorMutationStatusHarness
        savedVisibleMs={100}
        mutation={() => Promise.resolve('ok')}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Run mutation' }));

    expect(screen.getByText('saving:Saving')).toBeTruthy();
    await act(async () => {});
    expect(screen.getByText('saved:Saved')).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByText('idle:')).toBeTruthy();
  });

  it('reports error when the latest immediate mutation fails', async () => {
    render(
      <TakeEditorMutationStatusHarness
        mutation={() => Promise.reject(new Error('Selection failed'))}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Run mutation' }));

    expect(screen.getByText('saving:Saving')).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByText('error:Selection failed')).toBeTruthy()
    );
  });

  it('lets the latest overlapping mutation own the final status', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const mutation = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    render(<TakeEditorMutationStatusHarness mutation={mutation} />);

    fireEvent.click(screen.getByRole('button', { name: 'Run mutation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Run mutation' }));

    first.resolve('first');
    await waitFor(() => expect(screen.getByText('saving:Saving')).toBeTruthy());

    second.resolve('second');

    await waitFor(() => expect(screen.getByText('saved:Saved')).toBeTruthy());
  });
});

function deferred<TValue>() {
  let resolve: (value: TValue) => void = () => {};
  const promise = new Promise<TValue>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function TakeEditorMutationStatusHarness({
  mutation,
  savedVisibleMs,
}: {
  mutation: () => Promise<unknown>;
  savedVisibleMs?: number;
}) {
  const { status, runTakeEditorMutation } = useTakeEditorMutationStatus({
    failureMessage: 'Mutation failed.',
    savedVisibleMs,
  });
  return (
    <div>
      <p>{`${status.state}:${status.message ?? ''}`}</p>
      <Button
        type='button'
        onClick={() => {
          void runTakeEditorMutation(mutation).catch(() => undefined);
        }}
      >
        Run mutation
      </Button>
    </div>
  );
}
