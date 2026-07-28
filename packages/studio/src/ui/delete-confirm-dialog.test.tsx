// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '@/ui/button';
import { DeleteConfirmDialog } from './delete-confirm-dialog';

describe('DeleteConfirmDialog', () => {
  it('stays open and shows a deletion failure inside the dialog', async () => {
    const unhandledRejection = vi.fn();
    window.addEventListener('unhandledrejection', unhandledRejection);
    const onDelete = vi.fn().mockRejectedValue(
      new Error('The Shot Plan could not be deleted.')
    );
    render(
      <DeleteConfirmDialog
        title='Delete Shot Plan?'
        message='This Shot Plan will move to Trash.'
        onDelete={onDelete}
        trigger={<Button type='button'>Open delete confirmation</Button>}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Open delete confirmation' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(
      await screen.findByText('The Shot Plan could not be deleted.')
    ).not.toBeNull();
    expect(screen.getByRole('dialog')).not.toBeNull();
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(unhandledRejection).not.toHaveBeenCalled();
    window.removeEventListener('unhandledrejection', unhandledRejection);
  });

  it('disables dismissal while pending and closes after deletion succeeds', async () => {
    let resolveDelete: (() => void) | undefined;
    const onDelete = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        })
    );
    render(
      <DeleteConfirmDialog
        title='Delete Shot Plan?'
        message='This Shot Plan will move to Trash.'
        onDelete={onDelete}
        trigger={<Button type='button'>Open delete confirmation</Button>}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Open delete confirmation' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(
      screen.getByRole('button', { name: 'Deleting...' }).hasAttribute(
        'disabled'
      )
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')
    ).toBe(true);
    resolveDelete?.();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Open delete confirmation' })
    );
  });
});
