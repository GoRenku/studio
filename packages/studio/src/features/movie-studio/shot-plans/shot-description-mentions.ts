import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { Extension } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  hoverTooltip,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type Tooltip,
  type ViewUpdate,
} from '@codemirror/view';
import {
  screenplayEntityMentionAtPosition,
  screenplayEntityMentionRanges,
  type ScreenplayEntityMentionCatalog,
  type ScreenplayEntityMentionRange,
} from '../screenplay-entity-mentions';
import { ScreenplayEntityImagePreview } from '../screenplay-entity-image-preview';

export function shotDescriptionMentions(
  catalog: ScreenplayEntityMentionCatalog
): Extension {
  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
          this.decorations = buildMentionDecorations(view, catalog);
        }

        update(update: ViewUpdate) {
          if (update.docChanged) {
            this.decorations = buildMentionDecorations(update.view, catalog);
          }
        }
      },
      {
        decorations: (plugin) => plugin.decorations,
      }
    ),
    hoverTooltip((view, position) => {
      const range = screenplayEntityMentionAtPosition(
        view.state.doc.toString(),
        position,
        catalog
      );
      return range?.entity.imageUrl ? tooltipForRange(range) : null;
    }, { hoverTime: 180 }),
  ];
}

class ShotDescriptionMentionWidget extends WidgetType {
  private readonly range: ScreenplayEntityMentionRange;

  constructor(range: ScreenplayEntityMentionRange) {
    super();
    this.range = range;
  }

  eq(other: ShotDescriptionMentionWidget): boolean {
    return (
      other.range.source === this.range.source &&
      other.range.entity.kind === this.range.entity.kind &&
      other.range.entity.id === this.range.entity.id &&
      other.range.entity.label === this.range.entity.label
    );
  }

  toDOM(): HTMLElement {
    const mention = document.createElement('span');
    mention.className = 'cm-shot-description-mention';
    mention.textContent = `@${this.range.entity.label}`;
    mention.setAttribute(
      'aria-label',
      `${this.range.entity.label}, ${
        this.range.entity.kind === 'castMember' ? 'Cast Member' : 'Location'
      } mention`
    );
    mention.dataset.screenplayEntityMentionKind = this.range.entity.kind;
    mention.dataset.screenplayEntityMentionSource = this.range.source;
    return mention;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

function buildMentionDecorations(
  view: EditorView,
  catalog: ScreenplayEntityMentionCatalog
): DecorationSet {
  const ranges = screenplayEntityMentionRanges(
    view.state.doc.toString(),
    catalog
  ).map((range) =>
    Decoration.replace({
      widget: new ShotDescriptionMentionWidget(range),
    }).range(range.from, range.to)
  );
  return Decoration.set(ranges, true);
}

function tooltipForRange(range: ScreenplayEntityMentionRange): Tooltip {
  return {
    pos: range.from,
    end: range.to,
    above: true,
    arrow: false,
    create: () => {
      const dom = document.createElement('div');
      dom.className = 'cm-shot-description-entity-preview';
      const root = createRoot(dom);
      flushSync(() => {
        root.render(
          createElement(ScreenplayEntityImagePreview, {
            kind: range.entity.kind,
            label: range.entity.label,
            imageUrl: range.entity.imageUrl ?? '',
          })
        );
      });
      return {
        dom,
        destroy: () => root.unmount(),
      };
    },
  };
}
