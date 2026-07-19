// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImageRevisionDialog } from './image-revision-dialog';

const useImageRevisionEditor = vi.hoisted(() => vi.fn());

vi.mock('./use-image-revision-editor', () => ({ useImageRevisionEditor }));

afterEach(() => {
  vi.clearAllMocks();
});

describe('ImageRevisionDialog', () => {
  it('uses the shared stable desktop frame and keeps source copy in the header', () => {
    useImageRevisionEditor.mockReturnValue(editorFixture(false));

    render(
      <ImageRevisionDialog
        open
        request={request}
        onOpenChange={() => {}}
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('generation-request-dialog');
    expect(dialog.className).toContain('h-[760px]');
    expect(dialog.className).toContain('w-[1120px]');
    expect(dialog.className).toContain(
      'grid-rows-[auto_auto_minmax(0,1fr)_auto]',
    );
    expect(
      screen.getByText('Revise Urban character sheet').closest(
        '[data-slot="dialog-header"]',
      )?.className,
    ).toContain('h-[72px]');
    expect(screen.getByText('Revise Urban character sheet')).toBeTruthy();
    expect(screen.queryByText('Original Generation Request')).toBeNull();
  });

  it('blocks Escape and footer close while a revision run is pending', () => {
    useImageRevisionEditor.mockReturnValue(editorFixture(true));
    const onOpenChange = vi.fn();

    render(
      <ImageRevisionDialog
        open
        request={request}
        onOpenChange={onOpenChange}
      />,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled'))
      .toBe(true);
  });

  it('keeps a raw source identifier out of the dialog title', () => {
    useImageRevisionEditor.mockReturnValue(
      editorFixture(false, 'urban-s-cannon-drawing'),
    );

    render(
      <ImageRevisionDialog
        open
        request={request}
        onOpenChange={() => {}}
      />,
    );

    expect(screen.getByText('Revise Image')).toBeTruthy();
    expect(screen.queryByText('Revise urban-s-cannon-drawing')).toBeNull();
  });
});

const request = {
  projectName: 'urban-basilica',
  target: {
    kind: 'castCharacterSheet' as const,
    castMemberId: 'cast_urban',
    assetId: 'asset_source',
    assetFileId: 'file_source',
  },
};

function editorFixture(
  runPending: boolean,
  sourceTitle = 'Urban character sheet',
) {
  return {
    context: {
      source: {
        title: sourceTitle,
        assetId: 'asset_source',
        assetFileId: 'file_source',
      },
      regenerate: {
        state: 'unavailable',
        mode: 'regenerate',
        diagnostics: [{ message: 'No source request.' }],
      },
      edit: {
        state: 'available',
        mode: 'edit',
        draft: null,
        preview: null,
        controls: [],
        diagnostics: [],
      },
    },
    mode: 'edit',
    modeContext: { state: 'available' },
    draft: null,
    editorDraft: null,
    preview: null,
    estimatedUsd: null,
    loading: true,
    estimatePending: false,
    runPending,
    error: null,
    editorRevision: 0,
    controls: [],
    changeMode: vi.fn(),
    updateAuthoredText: vi.fn(),
    updateNegativeText: vi.fn(),
    updateControl: vi.fn(),
    chooseModel: vi.fn(),
    chooseReference: vi.fn(),
    run: vi.fn(),
  } as never;
}
