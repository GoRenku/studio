import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { Prec, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';

const shotDescriptionHighlightStyle = HighlightStyle.define([
  {
    tag: [
      tags.heading1,
      tags.heading2,
      tags.heading3,
      tags.heading4,
      tags.heading5,
      tags.heading6,
    ],
    color: 'var(--shot-description-heading-foreground)',
    fontWeight: '700',
  },
  {
    tag: tags.strong,
    color: 'var(--shot-cinema-term-foreground)',
    fontWeight: '700',
  },
]);

export const shotDescriptionTheme: Extension = [
  EditorView.theme({
    '.cm-shot-description-mention': {
      borderRadius: '3px',
      color: 'var(--shot-entity-mention-foreground)',
      fontWeight: '700',
    },
    '.cm-shot-description-mention:hover': {
      backgroundColor: 'var(--shot-entity-mention-hover)',
    },
    '.cm-tooltip': {
      border: '0',
      backgroundColor: 'transparent',
      boxShadow: 'none',
      overflow: 'visible',
    },
  }),
  Prec.highest(syntaxHighlighting(shotDescriptionHighlightStyle)),
];
