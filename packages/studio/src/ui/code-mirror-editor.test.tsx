// @vitest-environment jsdom
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CodeMirrorEditor } from './code-mirror-editor';

const noExtensions: readonly Extension[] = [];

beforeEach(() => {
  installRangeGeometry();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CodeMirrorEditor', () => {
  it('creates one editor view, synchronizes controlled replacements, and cleans up', () => {
    const onValueChange = vi.fn();
    const destroy = vi.spyOn(EditorView.prototype, 'destroy');
    const { container, rerender, unmount } = render(
      <CodeMirrorEditor
        value='First value'
        onValueChange={onValueChange}
        extensions={noExtensions}
        ariaLabel='Document'
      />,
    );
    expect(container.querySelectorAll('.cm-editor')).toHaveLength(1);

    rerender(
      <CodeMirrorEditor
        value='Externally replaced'
        onValueChange={onValueChange}
        extensions={noExtensions}
        ariaLabel='Document'
      />,
    );
    expect(container.querySelectorAll('.cm-editor')).toHaveLength(1);
    expect(screen.getByRole('textbox', { name: 'Document' }).textContent)
      .toBe('Externally replaced');
    expect(onValueChange).not.toHaveBeenCalled();

    unmount();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['LF', 'First\nSecond', 'First!\nSecond'],
    ['CRLF', 'First\r\nSecond', 'First!\r\nSecond'],
  ])('preserves exact %s separators after a user edit', (_name, initialValue, expected) => {
    const onValueChange = vi.fn();
    render(
      <CodeMirrorEditor
        value={initialValue}
        onValueChange={onValueChange}
        extensions={noExtensions}
        ariaLabel='Document'
      />,
    );
    const view = editorView('Document');
    view.dispatch({ changes: { from: 5, insert: '!' } });
    expect(onValueChange).toHaveBeenLastCalledWith(expected);
  });

  it('keeps every mixed line ending as a real editor line and preserves it after editing', () => {
    const onValueChange = vi.fn();
    render(
      <CodeMirrorEditor
        value={'First\r\nSecond\nThird\rFourth'}
        onValueChange={onValueChange}
        extensions={noExtensions}
        ariaLabel='Document'
      />,
    );
    const view = editorView('Document');
    expect(view.state.doc.toString()).toBe('First\nSecond\nThird\nFourth');
    expect(view.state.doc.lines).toBe(4);

    view.dispatch({ changes: { from: 5, insert: '!' } });
    expect(onValueChange).toHaveBeenLastCalledWith(
      'First!\r\nSecond\nThird\rFourth',
    );

    const thirdLineEnd = view.state.doc.toString().indexOf('Third') + 'Third'.length;
    view.dispatch({ changes: { from: thirdLineEnd, insert: '!' } });
    expect(onValueChange).toHaveBeenLastCalledWith(
      'First!\r\nSecond\nThird!\rFourth',
    );
  });

  it('uses the prevailing line ending for newly inserted lines', () => {
    const onValueChange = vi.fn();
    render(
      <CodeMirrorEditor
        value={'First\r\nSecond\r\nThird\nFourth'}
        onValueChange={onValueChange}
        extensions={noExtensions}
        ariaLabel='Document'
      />,
    );
    const view = editorView('Document');
    view.dispatch({
      changes: { from: view.state.doc.length, insert: '\nFifth' },
    });
    expect(onValueChange).toHaveBeenLastCalledWith(
      'First\r\nSecond\r\nThird\nFourth\r\nFifth',
    );
  });

  it.each([
    ['LF to CRLF', 'One\nTwo', 'Alpha\r\nBeta', 'Alpha!\r\nBeta'],
    ['CRLF to LF', 'One\r\nTwo', 'Alpha\nBeta', 'Alpha!\nBeta'],
  ])('retains an external %s separator change after editing', (
    _name,
    initialValue,
    replacement,
    expected,
  ) => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <CodeMirrorEditor
        value={initialValue}
        onValueChange={onValueChange}
        extensions={noExtensions}
        ariaLabel='Document'
      />,
    );
    rerender(
      <CodeMirrorEditor
        value={replacement}
        onValueChange={onValueChange}
        extensions={noExtensions}
        ariaLabel='Document'
      />,
    );
    const view = editorView('Document');
    view.dispatch({ changes: { from: 5, insert: '!' } });
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith(expected);
  });

  it('keeps mixed line structure after an external controlled replacement', () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <CodeMirrorEditor
        value={'One\nTwo'}
        onValueChange={onValueChange}
        extensions={noExtensions}
        ariaLabel='Document'
      />,
    );
    rerender(
      <CodeMirrorEditor
        value={'Alpha\r\nBeta\nGamma'}
        onValueChange={onValueChange}
        extensions={noExtensions}
        ariaLabel='Document'
      />,
    );
    const view = editorView('Document');
    expect(view.state.doc.toString()).toBe('Alpha\nBeta\nGamma');
    expect(view.state.doc.lines).toBe(3);
    expect(onValueChange).not.toHaveBeenCalled();

    view.dispatch({ changes: { from: view.state.doc.length, insert: '!' } });
    expect(onValueChange).toHaveBeenLastCalledWith('Alpha\r\nBeta\nGamma!');
  });

  it('keeps read-only text focusable and selectable with accessible control attributes', () => {
    const onValueChange = vi.fn();
    render(
      <CodeMirrorEditor
        value='Selectable text'
        onValueChange={onValueChange}
        extensions={noExtensions}
        readOnly
        ariaLabel='Read-only document'
        placeholder='Write a prompt'
        spellCheck={false}
      />,
    );
    const textbox = screen.getByRole('textbox', { name: 'Read-only document' });
    const view = editorView('Read-only document');
    expect(textbox.getAttribute('aria-readonly')).toBe('true');
    expect(textbox.getAttribute('spellcheck')).toBe('false');
    expect(view.state.readOnly).toBe(true);
    textbox.focus();
    view.dispatch({ selection: { anchor: 0, head: 10 } });
    expect(document.activeElement).toBe(textbox);
    expect(view.state.selection.main.from).toBe(0);
    expect(view.state.selection.main.to).toBe(10);
    fireEvent.keyDown(textbox, { key: 'x' });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('shows the supplied placeholder without adding prompt-specific behavior', () => {
    render(
      <ControlledEditor initialValue='' placeholder='Write a prompt' />,
    );
    expect(screen.getByText('Write a prompt')).not.toBeNull();
  });
});

function ControlledEditor({
  initialValue,
  placeholder,
}: {
  initialValue: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <CodeMirrorEditor
      value={value}
      onValueChange={setValue}
      extensions={noExtensions}
      ariaLabel='Document'
      placeholder={placeholder}
    />
  );
}

function editorView(label: string): EditorView {
  const textbox = screen.getByRole('textbox', { name: label });
  const view = EditorView.findFromDOM(textbox);
  if (!view) throw new Error(`Expected CodeMirror editor for ${label}.`);
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
