import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';

export const markdownCodeHighlightStyle = HighlightStyle.define([
  {
    tag: [
      tags.heading1,
      tags.heading2,
      tags.heading3,
      tags.heading4,
      tags.heading5,
      tags.heading6,
    ],
    color: 'var(--primary)',
    fontWeight: '700',
  },
  {
    tag: tags.processingInstruction,
    color: 'var(--muted-foreground)',
    fontFamily: 'var(--font-mono)',
    fontWeight: '600',
  },
  { tag: tags.list, color: 'hsl(215 66% 67%)' },
  { tag: tags.strong, color: 'var(--foreground)', fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  {
    tag: [tags.link, tags.url],
    color: 'hsl(215 66% 67%)',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
  },
  { tag: tags.monospace, fontFamily: 'var(--font-mono)' },
]);

export const markdownCodeEditorTheme: Extension = [
  EditorView.theme({
    '&': {
      height: '100%',
      minHeight: '0',
      backgroundColor: 'transparent',
      color: 'var(--editor-fg)',
      fontFamily: 'var(--font-sans)',
      fontSize: '15px',
    },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': {
      minHeight: '0',
      overflow: 'auto',
      fontFamily: 'inherit',
      lineHeight: '1.72',
    },
    '.cm-content': {
      width: 'min(790px, 100%)',
      minHeight: '100%',
      margin: '0 auto',
      padding: '36px 0 56px',
      caretColor: 'var(--primary)',
      fontFamily: 'inherit',
    },
    '.cm-line': { padding: '0' },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--primary)',
      borderLeftWidth: '2px',
    },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection':
      { backgroundColor: 'hsl(215 70% 55% / 0.28)' },
  }),
  syntaxHighlighting(markdownCodeHighlightStyle),
];
