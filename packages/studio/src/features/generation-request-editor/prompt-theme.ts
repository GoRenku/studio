import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdownCodeEditorTheme } from '@/ui/markdown-code-editor-theme';

const promptEditorTheme = EditorView.theme({
  '.cm-placeholder': {
    color: 'var(--muted-foreground)',
    fontStyle: 'normal',
  },
  '.cm-prompt-reference-mention': {
    borderRadius: '3px',
    color: 'var(--editor-mention-foreground)',
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
    color: 'var(--editor-mention-foreground)',
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    fontWeight: '650',
  },
  '.cm-tooltip.cm-tooltip-hover': {
    border: '0',
    backgroundColor: 'transparent',
    boxShadow: 'none',
    overflow: 'visible',
  },
  '.cm-prompt-reference-preview': {
    width: '328px',
    padding: '7px',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    backgroundColor: 'var(--popover)',
    boxShadow: '0 18px 48px hsl(0 0% 0% / 0.32), 0 4px 12px hsl(0 0% 0% / 0.2)',
    overflow: 'hidden',
  },
  '.cm-prompt-reference-preview-image': {
    display: 'block',
    width: '312px',
    height: '174px',
    borderRadius: '5px',
    backgroundColor: 'hsl(0 0% 7%)',
    objectFit: 'contain',
  },
});

export const promptTheme: Extension = [
  markdownCodeEditorTheme,
  promptEditorTheme,
];
