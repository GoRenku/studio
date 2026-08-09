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

  it('requires the exact confirmation value and passes it to deletion', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <DeleteConfirmDialog
        title='Delete Project?'
        message='This permanently deletes every file in this Project.'
        confirmation={{
          expectedValue: 'the-glass-harbor',
          instruction: 'Type the-glass-harbor to confirm.',
          label: 'Project name',
        }}
        deleteLabel='Delete Project'
        onDelete={onDelete}
        trigger={<Button type='button'>Open delete confirmation</Button>}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Open delete confirmation' })
    );
    const deleteButton = screen.getByRole('button', {
      name: 'Delete Project',
    });
    const confirmationInput = screen.getByLabelText('Project name');

    fireEvent.change(confirmationInput, { target: { value: 'The Glass Harbor' } });
    expect(deleteButton.hasAttribute('disabled')).toBe(true);

    fireEvent.change(confirmationInput, {
      target: { value: 'the-glass-harbor' },
    });
    expect(deleteButton.hasAttribute('disabled')).toBe(false);
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('the-glass-harbor');
    });
  });

  it('clears the typed confirmation when the dialog is reopened', () => {
    render(
      <DeleteConfirmDialog
        title='Delete Project?'
        message='This permanently deletes every file in this Project.'
        confirmation={{
          expectedValue: 'the-glass-harbor',
          instruction: 'Type the-glass-harbor to confirm.',
          label: 'Project name',
        }}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        trigger={<Button type='button'>Open delete confirmation</Button>}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Open delete confirmation' })
    );
    fireEvent.change(screen.getByLabelText('Project name'), {
      target: { value: 'the-glass-harbor' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Open delete confirmation' })
    );

    expect(
      (screen.getByLabelText('Project name') as HTMLInputElement).value
    ).toBe('');
  });
});
