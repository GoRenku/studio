import type { Extension } from '@codemirror/state';
import { Decoration, MatchDecorator, ViewPlugin, type DecorationSet, type EditorView, type ViewUpdate } from '@codemirror/view';

/**
 * Presentation-only decoration of regexp matches. It styles the exact authored
 * text and never changes, validates or interprets it.
 */
export function directionMatchHighlight(regexp: RegExp, decoration: (match: RegExpExecArray) => Decoration): Extension {
  const decorator = new MatchDecorator({ regexp: new RegExp(regexp.source, regexp.flags.includes('g') ? regexp.flags : `${regexp.flags}g`), decoration });
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = decorator.createDeco(view); }
    update(update: ViewUpdate) { this.decorations = decorator.updateDeco(update, this.decorations); }
  }, { decorations: (plugin) => plugin.decorations });
}
