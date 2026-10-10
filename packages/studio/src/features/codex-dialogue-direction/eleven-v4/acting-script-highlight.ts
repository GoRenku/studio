import type { Extension } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';
import { directionMatchHighlight } from '../shared/direction-match-highlight';

const ACTING_TAG_PATTERN = /\[[^\]\n]*\]/g;
const actingScriptTag = Decoration.mark({ class: 'cm-acting-script-tag' });

/** Colours bracketed acting tags with the dialogue audio tag token. Presentation only. */
export const actingScriptHighlight: Extension = [
  directionMatchHighlight(ACTING_TAG_PATTERN, () => actingScriptTag),
  EditorView.theme({
    '.cm-acting-script-tag': {
      color: 'var(--dd-tag)',
      backgroundColor: 'var(--dd-tag-bg)',
      borderRadius: '4px',
    },
  }),
];
