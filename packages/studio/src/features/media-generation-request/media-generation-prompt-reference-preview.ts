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
  mediaGenerationPromptMentionAtPosition,
  mediaGenerationPromptMentionRanges,
  type MediaGenerationPromptMention,
  type MediaGenerationPromptMentionRange,
} from './media-generation-prompt-mentions';

export function mediaGenerationPromptReferencePreview(
  mentions: MediaGenerationPromptMention[],
): Extension {
  return [
    mentionDecorations(mentions),
    hoverTooltip((view, position) => {
      const range = mediaGenerationPromptMentionAtPosition(
        view.state.doc.toString(),
        position,
        mentions,
      );
      return range ? tooltipForRange(range) : null;
    }, { hoverTime: 180, hideOnChange: true }),
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

function mentionDecorations(mentions: MediaGenerationPromptMention[]): Extension {
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
  mentions: MediaGenerationPromptMention[],
): DecorationSet {
  const caret = view.state.selection.main.empty
    ? view.state.selection.main.head
    : null;
  const ranges = mediaGenerationPromptMentionRanges(view.state.doc.toString(), mentions).map(
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
  mentions: MediaGenerationPromptMention[],
): Tooltip | null {
  if (!selection.empty) return null;
  const range = mediaGenerationPromptMentionAtPosition(value, selection.head, mentions);
  return range ? tooltipForRange(range) : null;
}

function tooltipForRange(range: MediaGenerationPromptMentionRange): Tooltip {
  return {
    pos: range.from,
    end: range.to,
    above: true,
    arrow: false,
    create: () => ({ dom: renderReferencePreview(range.mention) }),
  };
}

function renderReferencePreview(mention: MediaGenerationPromptMention): HTMLElement {
  const preview = document.createElement('div');
  preview.className = 'cm-prompt-reference-preview';
  if (mention.kind === 'image' && mention.previewImageUrl) {
    const image = document.createElement('img');
    image.className = 'cm-prompt-reference-preview-image';
    image.src = mention.previewImageUrl;
    image.alt = mention.accessibleName;
    preview.append(image);
  }
  return preview;
}
