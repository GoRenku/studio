import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';

const promptHighlightStyle = HighlightStyle.define([
  {
    tag: [tags.heading1, tags.heading2, tags.heading3, tags.heading4, tags.heading5, tags.heading6],
    color: 'var(--primary)',
    fontWeight: '700',
  },
  {
    tag: tags.processingInstruction,
    color: 'var(--muted-foreground)',
    fontFamily: 'var(--font-mono)',
    fontWeight: '600',
  },
  {
    tag: tags.list,
    color: 'hsl(215 66% 67%)',
  },
  {
    tag: tags.strong,
    color: 'var(--foreground)',
    fontWeight: '700',
  },
  {
    tag: tags.emphasis,
    fontStyle: 'italic',
  },
  {
    tag: [tags.link, tags.url],
    color: 'hsl(215 66% 67%)',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
  },
  {
    tag: tags.monospace,
    fontFamily: 'var(--font-mono)',
  },
]);

const promptEditorTheme = EditorView.theme({
  '&': {
    height: '100%',
    minHeight: '0',
    backgroundColor: 'transparent',
    color: 'var(--editor-fg)',
    fontFamily: 'var(--font-sans)',
    fontSize: '15px',
  },
  '&.cm-focused': {
    outline: 'none',
  },
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
  '.cm-line': {
    padding: '0',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--primary)',
    borderLeftWidth: '2px',
  },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'hsl(215 70% 55% / 0.28)',
  },
  '.cm-placeholder': {
    color: 'var(--muted-foreground)',
    fontStyle: 'normal',
  },
  '.cm-prompt-reference-mention': {
    borderRadius: '3px',
    color: 'hsl(169 52% 58%)',
    fontWeight: '650',
  },
  '.cm-prompt-reference-mention:hover, .cm-prompt-reference-mention-active': {
    backgroundColor: 'hsl(169 52% 58% / 0.1)',
  },
  '.cm-tooltip': {
    border: '1px solid var(--border)',
    borderRadius: '8px',
    backgroundColor: 'var(--popover)',
    color: 'var(--popover-foreground)',
    boxShadow: '0 18px 48px hsl(0 0% 0% / 0.32), 0 4px 12px hsl(0 0% 0% / 0.2)',
    overflow: 'hidden',
  },
  '.cm-tooltip.cm-prompt-reference-completion': {
    width: '356px',
  },
  '.cm-tooltip.cm-prompt-reference-completion > ul': {
    maxHeight: '264px',
    padding: '5px',
    fontFamily: 'var(--font-sans)',
  },
  '.cm-tooltip.cm-prompt-reference-completion > ul > li': {
    minHeight: '54px',
    padding: '7px',
    borderRadius: '5px',
  },
  '.cm-tooltip.cm-prompt-reference-completion > ul > li[aria-selected]': {
    backgroundColor: 'var(--accent)',
    color: 'var(--accent-foreground)',
  },
  '.cm-prompt-reference-option .cm-completionLabel, .cm-prompt-reference-option .cm-completionDetail': {
    display: 'none',
  },
  '.cm-prompt-reference-option-content': {
    display: 'grid',
    minWidth: '0',
    gridTemplateColumns: '64px minmax(0, 1fr)',
    alignItems: 'center',
    gap: '11px',
  },
  '.cm-prompt-reference-option-image': {
    display: 'block',
    width: '64px',
    height: '40px',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    backgroundColor: 'hsl(0 0% 7%)',
    objectFit: 'cover',
  },
  '.cm-prompt-reference-option-copy': {
    display: 'grid',
    minWidth: '0',
    gap: '3px',
  },
  '.cm-prompt-reference-option-title': {
    overflow: 'hidden',
    color: 'var(--popover-foreground)',
    fontSize: '12px',
    fontWeight: '620',
    lineHeight: '1.35',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  '.cm-prompt-reference-option-token': {
    color: 'hsl(169 52% 58%)',
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    fontWeight: '650',
  },
  '.cm-tooltip > .cm-prompt-reference-preview': {
    width: '328px',
    padding: '7px',
  },
  '.cm-prompt-reference-preview-image': {
    display: 'block',
    width: '312px',
    height: '174px',
    borderRadius: '5px',
    backgroundColor: 'hsl(0 0% 7%)',
    objectFit: 'contain',
  },
  '.cm-prompt-reference-preview-title': {
    overflow: 'hidden',
    margin: '0',
    padding: '10px 6px 5px',
    color: 'var(--popover-foreground)',
    fontSize: '12px',
    fontWeight: '620',
    lineHeight: '1.35',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
});

export const promptTheme: Extension = [
  promptEditorTheme,
  syntaxHighlighting(promptHighlightStyle),
];
