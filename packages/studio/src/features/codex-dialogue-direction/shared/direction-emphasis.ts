import type { Extension } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';
import type { DialogueDirectionEmphasis } from '@gorenku/studio-codex/dialogue-direction';
import { directionMatchHighlight } from './direction-match-highlight';

/** A Voice Mention and the colour of the speaker it refers to. */
export interface DirectionMentionColour {
  mention: string;
  colour: string;
}

const emphasisTheme = EditorView.theme({
  '.cm-direction-tag': { color: 'var(--dd-tag)', backgroundColor: 'var(--dd-tag-bg)', borderRadius: '4px' },
  '.cm-direction-quote': { color: 'var(--dd-quote)', fontWeight: '500' },
  '.cm-direction-mention': { borderRadius: '4px', fontWeight: '500' },
});

const EMPHASIS_HIGHLIGHTS: Record<DialogueDirectionEmphasis, Extension> = {
  'bracket-tags': directionMatchHighlight(/\[[^\]\n]*\]/g, () => Decoration.mark({ class: 'cm-direction-tag' })),
  'quoted-spans': directionMatchHighlight(/"[^"\n]*"/g, () => Decoration.mark({ class: 'cm-direction-quote' })),
};

const highlightsByKey = new Map<string, Extension>();

/**
 * Presentation-only highlighting of the route's emphasis syntax and of exact Voice Mentions in
 * their speakers' colours. Highlights are shared per configuration so editors keep a stable extension.
 */
export function directionEmphasisHighlight(emphasis: DialogueDirectionEmphasis | null, mentions: readonly DirectionMentionColour[]): Extension {
  const key = JSON.stringify([emphasis, mentions]);
  const cached = highlightsByKey.get(key);
  if (cached) return cached;
  const extensions: Extension[] = [emphasisTheme];
  if (emphasis) extensions.push(EMPHASIS_HIGHLIGHTS[emphasis]);
  if (mentions.length > 0) extensions.push(mentionHighlight(mentions));
  highlightsByKey.set(key, extensions);
  return extensions;
}

function mentionHighlight(mentions: readonly DirectionMentionColour[]): Extension {
  const ordered = [...mentions].sort((left, right) => right.mention.length - left.mention.length);
  const pattern = new RegExp(ordered.map((entry) => entry.mention.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
  return directionMatchHighlight(pattern, (match) => {
    const colour = ordered.find((entry) => entry.mention === match[0])!.colour;
    return Decoration.mark({
      class: 'cm-direction-mention',
      attributes: { style: `color: ${colour}; background-color: color-mix(in srgb, ${colour} 14%, transparent)` },
    });
  });
}
