import { useImperativeHandle, useLayoutEffect, useMemo, useState, type ReactNode, type Ref } from 'react';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { Prec, type Extension } from '@codemirror/state';
import { EditorView, ViewPlugin, keymap } from '@codemirror/view';
import { CodeMirrorEditor } from '@/ui/code-mirror-editor';
import { cn } from '@/lib/utils';

export interface DirectionEditorHandle {
  /** Inserts text at the cursor, padded with spaces, and focuses the editor. */
  insertText: (text: string) => void;
}

const directionEditorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'transparent',
    color: 'var(--dd-card-fg)',
    fontFamily: 'var(--dd-font-mono)',
    fontSize: 'var(--dd-editor-font-size, 14px)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.75' },
  '.cm-content': { minHeight: 'var(--dd-editor-min-height, 120px)', padding: 'var(--dd-editor-padding, 14px 16px)', caretColor: 'var(--dd-fg)', fontFamily: 'inherit' },
  '.cm-line': { padding: '0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--dd-fg)' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection':
    { backgroundColor: 'hsl(42 58% 50% / 0.3)' },
});

/** Bridges the CodeMirror view to the latest React callbacks without reconfiguring the editor. */
class DirectionEditorController {
  private view: EditorView | null = null;
  private onGenerate: () => void = () => {};
  private onFocus: (() => void) | undefined;

  readonly extension: Extension = [
    Prec.highest(keymap.of([{ key: 'Mod-Enter', run: () => { this.onGenerate(); return true; } }])),
    EditorView.domEventHandlers({ focus: () => { this.onFocus?.(); return false; } }),
    ViewPlugin.define((view) => {
      this.view = view;
      return { destroy: () => { if (this.view === view) this.view = null; } };
    }),
  ];

  connect(onGenerate: () => void, onFocus: (() => void) | undefined): void {
    this.onGenerate = onGenerate;
    this.onFocus = onFocus;
  }

  insertText(text: string): void {
    const view = this.view;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    const before = from > 0 ? view.state.sliceDoc(from - 1, from) : '';
    const insert = `${before && !/\s/.test(before) ? ' ' : ''}${text} `;
    view.dispatch({ changes: { from, to, insert }, selection: { anchor: from + insert.length } });
    view.focus();
  }
}

export function DirectionEditor(input: {
  value: string;
  onValueChange: (value: string) => void;
  highlight: Extension;
  ariaLabel: string;
  size?: 'script' | 'compact' | 'prompt';
  footer?: ReactNode;
  handleRef?: Ref<DirectionEditorHandle>;
  onGenerate: () => void;
  onFocus?: () => void;
}) {
  const [controller] = useState(() => new DirectionEditorController());
  useLayoutEffect(() => {
    controller.connect(input.onGenerate, input.onFocus);
  }, [controller, input.onGenerate, input.onFocus]);
  useImperativeHandle(input.handleRef, () => ({ insertText: (text: string) => controller.insertText(text) }), [controller]);
  const extensions = useMemo<readonly Extension[]>(() => [
    EditorView.lineWrapping,
    directionEditorTheme,
    input.highlight,
    history(),
    controller.extension,
    keymap.of([...defaultKeymap, ...historyKeymap]),
  ], [controller, input.highlight]);

  return (
    <div className='overflow-hidden rounded-[10px] border border-[var(--dd-border)] bg-[var(--dd-editor)]'>
      <div className={cn(input.size === 'compact' && '[--dd-editor-min-height:0px] [--dd-editor-padding:10px_14px]', input.size === 'prompt' && '[--dd-editor-font-size:13.5px] [--dd-editor-min-height:200px]')}>
        <CodeMirrorEditor value={input.value} onValueChange={input.onValueChange} extensions={extensions} ariaLabel={input.ariaLabel} spellCheck={false} />
      </div>
      {input.footer ? <div className={cn('flex flex-wrap items-center gap-1.5', input.size === 'compact' ? 'px-2 pb-1 pt-0' : 'pb-2 pl-3 pr-2 pt-1.5')}>{input.footer}</div> : null}
    </div>
  );
}
