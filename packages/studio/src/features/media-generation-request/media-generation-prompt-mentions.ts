export interface MediaGenerationPromptMention {
  value: string;
  accessibleName: string;
  kind: 'image' | 'video' | 'audio';
  previewImageUrl?: string;
}

export interface MediaGenerationPromptMentionQuery {
  start: number;
  end: number;
  query: string;
}

export interface MediaGenerationPromptMentionRange {
  from: number;
  to: number;
  mention: MediaGenerationPromptMention;
}

export function mediaGenerationPromptMentionQuery(
  value: string,
  caret: number,
): MediaGenerationPromptMentionQuery | null {
  const before = value.slice(0, caret);
  const match = /(?:^|[\s([{])(@\S*)$/.exec(before);
  if (!match) return null;
  const query = match[1]!;
  return { start: caret - query.length, end: caret, query };
}

export function mediaGenerationPromptMentionRanges(
  value: string,
  mentions: MediaGenerationPromptMention[],
): MediaGenerationPromptMentionRange[] {
  const ranges: MediaGenerationPromptMentionRange[] = [];
  for (const mention of mentions) {
    let from = value.indexOf(mention.value);
    while (from >= 0) {
      const to = from + mention.value.length;
      if (hasMentionBoundaries(value, from, to)) {
        ranges.push({ from, to, mention });
      }
      from = value.indexOf(mention.value, to);
    }
  }
  return ranges.sort((left, right) => left.from - right.from || left.to - right.to);
}

export function mediaGenerationPromptMentionAtPosition(
  value: string,
  position: number,
  mentions: MediaGenerationPromptMention[],
): MediaGenerationPromptMentionRange | null {
  return mediaGenerationPromptMentionRanges(value, mentions).find(
    (range) => position >= range.from && position <= range.to,
  ) ?? null;
}

export function filterMediaGenerationPromptMentions(
  mentions: MediaGenerationPromptMention[],
  query: string,
): MediaGenerationPromptMention[] {
  const atMentionQuery = query.startsWith('@');
  const normalized = atMentionQuery ? query.slice(1).toLocaleLowerCase() : query.toLocaleLowerCase();
  return mentions.filter((mention) =>
    (!atMentionQuery || mention.value.startsWith('@')) && (
      (mention.value.startsWith('@') ? mention.value.slice(1) : mention.value)
      .toLocaleLowerCase().includes(normalized) ||
      mention.accessibleName.toLocaleLowerCase().includes(normalized)
    )
  );
}

function hasMentionBoundaries(value: string, from: number, to: number): boolean {
  const leftBoundary = from === 0 || !/[A-Za-z0-9_]/.test(value[from - 1]!);
  const rightBoundary = to === value.length || !/[A-Za-z0-9_]/.test(value[to]!);
  return leftBoundary && rightBoundary;
}
