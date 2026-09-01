import type { ReactNode } from 'react';

export const DIALOGUE_PERFORMANCE_TAG_PATTERN = /\[[^\]\n]{1,48}\]/g;

export const DIALOGUE_PERFORMANCE_TAG_CLASS_NAME =
  'font-medium text-dialogue-audio-tag';

export function isDialoguePerformanceTag(value: string): boolean {
  DIALOGUE_PERFORMANCE_TAG_PATTERN.lastIndex = 0;
  return DIALOGUE_PERFORMANCE_TAG_PATTERN.test(value);
}

export function renderDialoguePerformanceTaggedText(value: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  DIALOGUE_PERFORMANCE_TAG_PATTERN.lastIndex = 0;
  for (const match of value.matchAll(DIALOGUE_PERFORMANCE_TAG_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push(
        <span key={`text-${key++}`}>{value.slice(lastIndex, index)}</span>
      );
    }
    parts.push(
      <span key={`tag-${key++}`} className={DIALOGUE_PERFORMANCE_TAG_CLASS_NAME}>
        {match[0]}
      </span>
    );
    lastIndex = index + match[0].length;
  }

  if (lastIndex < value.length) {
    parts.push(<span key={`text-${key++}`}>{value.slice(lastIndex)}</span>);
  }

  return parts;
}
