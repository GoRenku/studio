import { act, screen } from '@testing-library/react';
import { EditorView } from '@codemirror/view';

/** jsdom has no layout: CodeMirror needs range geometry and Radix controls need ResizeObserver. */
export function installDirectionPanelEnvironment(): void {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] });
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) }),
  });
  HTMLElement.prototype.scrollIntoView = () => {};
}

export function directionEditorView(label: string): EditorView {
  const view = EditorView.findFromDOM(screen.getByRole('textbox', { name: label }));
  if (!view) throw new Error(`Expected a CodeMirror editor for ${label}.`);
  return view;
}

export function replaceDirectionEditorText(label: string, text: string): void {
  const view = directionEditorView(label);
  act(() => { view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } }); });
}
