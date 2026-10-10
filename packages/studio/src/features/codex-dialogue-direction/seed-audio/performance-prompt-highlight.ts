import type { Extension } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';
import { directionMatchHighlight } from '../shared/direction-match-highlight';

const QUOTED_SPAN_PATTERN = /"[^"\n]*"/g;
const AUDIO_MENTION_PATTERN = /@Audio([1-3])/g;
const highlightsByMentionColours = new Map<string, Extension>();
const quotedSpan = Decoration.mark({ class: 'cm-performance-prompt-quote' });

const performancePromptTheme = EditorView.theme({
  '.cm-performance-prompt-quote': { color: 'var(--dd-quote)', fontWeight: '500' },
  '.cm-performance-prompt-mention': { borderRadius: '4px', fontWeight: '500' },
});

/**
 * Emphasizes quoted spans and, when the route uses prompt audio tags, colours
 * each `@AudioN` with its speaker's colour. Presentation only. Highlights are
 * shared per colour set so the editor keeps a stable extension identity.
 */
export function performancePromptHighlight(mentionColours: readonly string[] | null): Extension {
  const key = mentionColours ? mentionColours.join('|') : '';
  const cached = highlightsByMentionColours.get(key);
  if (cached) return cached;
  const highlight = createPerformancePromptHighlight(mentionColours);
  highlightsByMentionColours.set(key, highlight);
  return highlight;
}

function createPerformancePromptHighlight(mentionColours: readonly string[] | null): Extension {
  const extensions: Extension[] = [performancePromptTheme, directionMatchHighlight(QUOTED_SPAN_PATTERN, () => quotedSpan)];
  if (mentionColours) {
    extensions.push(directionMatchHighlight(AUDIO_MENTION_PATTERN, (match) => {
      const colour = mentionColours[Number(match[1]) - 1];
      return Decoration.mark({
        class: 'cm-performance-prompt-mention',
        attributes: colour ? { style: `color: ${colour}; background-color: color-mix(in srgb, ${colour} 14%, transparent)` } : {},
      });
    }));
  }
  return extensions;
}
