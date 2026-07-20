import { StateField, type Extension } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  hoverTooltip,
  showTooltip,
  ViewPlugin,
  type DecorationSet,
  type Tooltip,
  type ViewUpdate,
} from '@codemirror/view';
import {
  generationPromptMentionAtPosition,
  generationPromptMentionRanges,
  type GenerationPromptMentionRange,
  type GenerationPromptReferenceMention,
} from './prompt-mentions';

export function promptReferencePreview(
  mentions: GenerationPromptReferenceMention[],
): Extension {
  return [
    mentionDecorations(mentions),
    hoverTooltip((view, position) => {
      const range = generationPromptMentionAtPosition(
        view.state.doc.toString(),
        position,
        mentions,
      );
      return range ? tooltipForRange(range) : null;
    }, { hoverTime: 180 }),
    StateField.define<Tooltip | null>({
      create: (state) => caretTooltip(state.doc.toString(), state.selection.main, mentions),
      update: (_tooltip, transaction) => caretTooltip(
        transaction.state.doc.toString(),
        transaction.state.selection.main,
        mentions,
      ),
      provide: (field) => showTooltip.from(field),
    }),
  ];
}

function mentionDecorations(
  mentions: GenerationPromptReferenceMention[],
): Extension {
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildMentionDecorations(view, mentions);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet) {
        this.decorations = buildMentionDecorations(update.view, mentions);
      }
    }
  }, {
    decorations: (plugin) => plugin.decorations,
  });
}

function buildMentionDecorations(
  view: EditorView,
  mentions: GenerationPromptReferenceMention[],
): DecorationSet {
  const caret = view.state.selection.main.empty
    ? view.state.selection.main.head
    : null;
  const ranges = generationPromptMentionRanges(view.state.doc.toString(), mentions).map(
    (range) => Decoration.mark({
      class: caret !== null && caret >= range.from && caret <= range.to
        ? 'cm-prompt-reference-mention cm-prompt-reference-mention-active'
        : 'cm-prompt-reference-mention',
    }).range(range.from, range.to),
  );
  return Decoration.set(ranges, true);
}

function caretTooltip(
  value: string,
  selection: { empty: boolean; head: number },
  mentions: GenerationPromptReferenceMention[],
): Tooltip | null {
  if (!selection.empty) return null;
  const range = generationPromptMentionAtPosition(value, selection.head, mentions);
  return range ? tooltipForRange(range) : null;
}

function tooltipForRange(range: GenerationPromptMentionRange): Tooltip {
  return {
    pos: range.from,
    end: range.to,
    above: true,
    arrow: false,
    create: () => ({ dom: renderReferencePreview(range.mention) }),
  };
}

function renderReferencePreview(
  mention: GenerationPromptReferenceMention,
): HTMLElement {
  const preview = document.createElement('div');
  preview.className = 'cm-prompt-reference-preview';
  const image = document.createElement('img');
  image.className = 'cm-prompt-reference-preview-image';
  image.src = mention.previewImageUrl;
  image.alt = mention.label;
  const title = document.createElement('p');
  title.className = 'cm-prompt-reference-preview-title';
  title.textContent = mention.label;
  preview.append(image, title);
  return preview;
}
