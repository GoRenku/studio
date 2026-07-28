// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MediaCardCollectionDialog } from './media-card-collection-dialog';
import type {
  MediaCardCollectionDialogState,
  MediaCardCollectionItem,
} from './media-card-contract';

describe('MediaCardCollectionDialog', () => {
  it('renders stable loading, error/retry, empty, and ready states', () => {
    const onRetry = vi.fn();
    const { rerender } = renderDialog({
      kind: 'loading',
      message: 'Loading images...',
    });
    expect(screen.getByText('Loading images...')).not.toBeNull();

    rerender(dialog({
      kind: 'error',
      message: 'Unable to load images.',
      retryLabel: 'Retry images',
      onRetry,
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Retry images' }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(dialog({
      kind: 'empty',
      message: 'No images.',
    }));
    expect(screen.getByText('No images.')).not.toBeNull();

    rerender(dialog({
      kind: 'ready',
      items: [item('one'), item('two')],
    }));
    expect(screen.getAllByRole('img').map((image) => image.getAttribute('alt')))
      .toEqual(['one', 'two']);
  });

  it('preserves flush and inset presentation anatomy', () => {
    const { rerender } = renderDialog({
      kind: 'ready',
      items: [item('one')],
    });
    const flush = screen.getByRole('dialog');
    expect(
      flush.getAttribute('data-media-card-collection-presentation')
    ).toBe('flush');
    expect(flush.className).toContain('p-0');
    expect(flush.querySelector('[data-media-card-grid]')?.parentElement?.className)
      .toContain('p-5');

    rerender(
      <MediaCardCollectionDialog
        open
        onOpenChange={vi.fn()}
        title='Images'
        description='Choose an image.'
        state={{ kind: 'ready', items: [item('one')] }}
        presentation={{ kind: 'inset' }}
        minimumCardWidthPx={220}
        gap='roomy'
      />
    );
    const inset = screen.getByRole('dialog');
    expect(
      inset.getAttribute('data-media-card-collection-presentation')
    ).toBe('inset');
    expect(inset.className).not.toContain('p-0');
    const grid = inset.querySelector<HTMLElement>('[data-media-card-grid]');
    expect(grid?.parentElement?.className).toContain('px-5');
    expect(grid?.className).toContain('gap-4');
    expect(grid?.style.gridTemplateColumns).toContain('220px');
  });

  it('retains prepared card callback, preview, selection, corner, and delete isolation', async () => {
    const onCallback = vi.fn();
    const onChoose = vi.fn();
    const onCorner = vi.fn();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderDialog({
      kind: 'ready',
      items: [{
        ...item('one'),
        card: {
          ...item('one').card,
          activation: {
            kind: 'callback',
            label: 'Open callback',
            onActivate: onCallback,
          },
          selection: {
            kind: 'choose',
            selected: false,
            selectedLabel: 'Selected image',
            unselectedLabel: 'Choose image',
            onChoose,
          },
          cornerAction: {
            kind: 'inspect',
            label: 'Inspect image',
            visibility: 'always',
            onAction: onCorner,
          },
          deleteAction: {
            label: 'Delete image',
            confirmationTitle: 'Delete image?',
            confirmationMessage: 'Confirm deletion.',
            onDelete,
          },
        },
      }, previewItem('two')],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Choose image' }));
    fireEvent.click(screen.getByRole('button', { name: 'Inspect image' }));
    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onCorner).toHaveBeenCalledTimes(1);
    expect(onCallback).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Open callback' }));
    expect(onCallback).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Preview two' }));
    expect(screen.getByRole('img', { name: 'Expanded two' })).not.toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: 'Close image preview' })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete image' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
    expect(onCallback).toHaveBeenCalledTimes(1);
  });

  it('closes through Escape and traps focus inside the open dialog', async () => {
    const onOpenChange = vi.fn();
    render(
      <MediaCardCollectionDialog
        open
        onOpenChange={onOpenChange}
        title='Images'
        description='Choose an image.'
        state={{ kind: 'ready', items: [item('one')] }}
        presentation={{ kind: 'flush' }}
        minimumCardWidthPx={220}
      />
    );

    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(
      true
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});

function renderDialog(state: MediaCardCollectionDialogState) {
  return render(dialog(state));
}

function dialog(state: MediaCardCollectionDialogState) {
  return (
    <MediaCardCollectionDialog
      open
      onOpenChange={vi.fn()}
      title='Images'
      description='Choose an image.'
      state={state}
      presentation={{ kind: 'flush' }}
      minimumCardWidthPx={220}
    />
  );
}

function item(id: string): MediaCardCollectionItem {
  return {
    id,
    card: {
      media: {
        kind: 'image',
        src: `/${id}.jpg`,
        alt: id,
        fit: 'cover',
        effect: 'none',
      },
      frame: { kind: 'ratio', aspectRatio: 1 },
      presentation: { kind: 'overlay' },
    },
  };
}

function previewItem(id: string): MediaCardCollectionItem {
  return {
    ...item(id),
    card: {
      ...item(id).card,
      activation: {
        kind: 'image-preview',
        label: `Preview ${id}`,
        image: {
          src: `/${id}.jpg`,
          alt: `Expanded ${id}`,
          title: id,
        },
      },
    },
  };
}
