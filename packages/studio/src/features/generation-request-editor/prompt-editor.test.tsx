// @vitest-environment jsdom
import {
  acceptCompletion,
  startCompletion,
} from '@codemirror/autocomplete';
import { EditorView, activateHover } from '@codemirror/view';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PromptEditor } from './prompt-editor';

const mentions = [
  {
    value: '@Reference1',
    title: 'Council chamber',
    accessibleName: 'Council chamber',
    previewImageUrl: '/studio-api/reference-1.png',
  },
  {
    value: '@Reference2',
    title: 'Imperial lookbook',
    accessibleName: 'Imperial lookbook',
    previewImageUrl: '/studio-api/reference-2.png',
  },
];

beforeEach(() => {
  installRangeGeometry();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PromptEditor', () => {
  it('emits one controlled prompt edit', () => {
    const onValueChange = vi.fn();
    render(
      <PromptEditor
        value='Polished prompt'
        onValueChange={onValueChange}
        mentions={mentions}
        ariaLabel='Generation prompt'
      />,
    );
    editorView().dispatch({ changes: { from: 8, insert: ' visual' } });
    expect(onValueChange).toHaveBeenCalledWith('Polished visual prompt');
  });

  it('applies one exact completion transaction and leaves unknown text unchanged', async () => {
    const onValueChange = vi.fn();
    render(
      <PromptEditor
        value='Use @Ref beside @Unknown.'
        onValueChange={onValueChange}
        mentions={mentions}
        ariaLabel='Generation prompt'
      />,
    );
    const view = editorView();
    view.dispatch({ selection: { anchor: 8 } });
    expect(startCompletion(view)).toBe(true);
    await screen.findByRole('listbox');
    expect(acceptCompletion(view)).toBe(true);
    expect(onValueChange).toHaveBeenLastCalledWith(
      'Use @Reference1 beside @Unknown.',
    );
  });

  it('refilters completion choices as the user continues typing', async () => {
    render(
      <PromptEditor
        value='Use @'
        onValueChange={() => {}}
        mentions={mentions}
        ariaLabel='Generation prompt'
      />,
    );
    const view = editorView();
    view.dispatch({ selection: { anchor: 5 } });
    expect(startCompletion(view)).toBe(true);
    await screen.findByRole('listbox');
    expect(screen.getAllByRole('option')).toHaveLength(2);

    view.dispatch({
      changes: { from: 5, insert: 'Council' },
      selection: { anchor: 12 },
      userEvent: 'input.type',
    });
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
    expect(screen.getByRole('option').textContent).toContain('Council chamber');
    expect(screen.queryByText('Imperial lookbook')).toBeNull();

    view.dispatch({
      changes: { from: 5, to: 12, insert: 'Missing' },
      selection: { anchor: 12 },
      userEvent: 'input.type',
    });
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
  });

  it('shows supplied preview content for caret and hover lookup', async () => {
    render(
      <PromptEditor
        value='Use @Reference1 beside @Reference2.'
        onValueChange={() => {}}
        mentions={mentions}
        ariaLabel='Generation prompt'
      />,
    );
    const view = editorView();
    const secondMention = view.state.doc.toString().indexOf('@Reference2');
    view.dispatch({ selection: { anchor: secondMention + 3 } });
    expect((await screen.findByRole('img', { name: 'Imperial lookbook' }))
      .getAttribute('src')).toBe('/studio-api/reference-2.png');
    expect(screen.queryByText('Imperial lookbook')).toBeNull();

    view.dispatch({ selection: { anchor: 0 } });
    activateHover(view, secondMention + 2, 1);
    expect((await screen.findByRole('img', { name: 'Imperial lookbook' }))
      .getAttribute('src')).toBe('/studio-api/reference-2.png');
    expect(screen.queryByText('Imperial lookbook')).toBeNull();
  });

  it('shows one preview when the caret enters an actively hovered mention', async () => {
    render(
      <PromptEditor
        value='Use @Reference1.'
        onValueChange={() => {}}
        mentions={mentions}
        ariaLabel='Generation prompt'
      />,
    );
    const view = editorView();
    const mention = view.state.doc.toString().indexOf('@Reference1');
    activateHover(view, mention + 2, 1);
    await screen.findByRole('img', { name: 'Council chamber' });

    view.dispatch({ selection: { anchor: mention + 3 } });

    await waitFor(() => expect(
      screen.getAllByRole('img', { name: 'Council chamber' }),
    ).toHaveLength(1));
  });

  it('keeps completion, decoration, and preview ranges normalized for CRLF prompts', async () => {
    const onValueChange = vi.fn();
    const value = 'First\r\nSecond\r\nUse @Ref and @Reference2.';
    render(
      <PromptEditor
        value={value}
        onValueChange={onValueChange}
        mentions={mentions}
        ariaLabel='Generation prompt'
      />,
    );
    const view = editorView();
    expect(view.state.doc.toString()).toBe('First\nSecond\nUse @Ref and @Reference2.');
    expect(document.querySelectorAll('.cm-prompt-reference-mention')).toHaveLength(1);
    const queryEnd = view.state.doc.toString().indexOf('@Ref') + 4;
    view.dispatch({ selection: { anchor: queryEnd } });
    startCompletion(view);
    await screen.findByRole('listbox');
    acceptCompletion(view);
    expect(onValueChange).toHaveBeenLastCalledWith(
      'First\r\nSecond\r\nUse @Reference1 and @Reference2.',
    );

    const secondMention = view.state.doc.toString().indexOf('@Reference2');
    view.dispatch({ selection: { anchor: secondMention + 2 } });
    expect(await screen.findByRole('img', { name: 'Imperial lookbook' }))
      .not.toBeNull();
  });

  it('keeps read-only text focusable and previewable without completion or edits', async () => {
    const onValueChange = vi.fn();
    render(
      <PromptEditor
        value='Use @Reference1.'
        onValueChange={onValueChange}
        mentions={mentions}
        readOnly
        ariaLabel='Generation prompt'
      />,
    );
    const textbox = screen.getByRole('textbox', { name: 'Generation prompt' });
    const view = editorView();
    textbox.focus();
    view.dispatch({ selection: { anchor: 7 } });
    expect(textbox.getAttribute('aria-readonly')).toBe('true');
    expect(await screen.findByRole('img', { name: 'Council chamber' })).not.toBeNull();
    expect(startCompletion(view)).toBe(false);
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('keeps an untitled project-file mention free of storage filenames', async () => {
    render(
      <PromptEditor
        value='Use @Reference1.'
        onValueChange={() => {}}
        mentions={[{
          value: '@Reference1',
          accessibleName: '@Reference1',
          previewImageUrl: '/studio-api/references/raw-storage-filename.png',
        }]}
        ariaLabel='Generation prompt'
      />,
    );
    const view = editorView();
    view.dispatch({ selection: { anchor: 7 } });
    expect(await screen.findByRole('img', { name: '@Reference1' })).not.toBeNull();
    expect(screen.queryByText('raw-storage-filename.png')).toBeNull();

    view.dispatch({
      changes: { from: 4, to: 15, insert: '@' },
      selection: { anchor: 5 },
    });
    expect(startCompletion(view)).toBe(true);
    const option = await screen.findByRole('option');
    expect(
      option.querySelector('.cm-prompt-reference-option-token')?.textContent,
    ).toBe('@Reference1');
    expect(option.querySelector('.cm-prompt-reference-option-title')).toBeNull();
    expect(option.textContent).not.toContain('raw-storage-filename.png');
  });
});

function editorView(): EditorView {
  const textbox = screen.getByRole('textbox', { name: 'Generation prompt' });
  const view = EditorView.findFromDOM(textbox);
  if (!view) throw new Error('Expected Generation prompt CodeMirror view.');
  return view;
}

function installRangeGeometry() {
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: () => [],
  });
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      bottom: 0,
      height: 0,
      left: 0,
      right: 0,
      top: 0,
      width: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  });
}
