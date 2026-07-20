export interface GenerationPromptReferenceMention {
  value: string;
  label: string;
  previewImageUrl: string;
}

export interface GenerationPromptMentionQuery {
  start: number;
  end: number;
  query: string;
}

export interface GenerationPromptMentionRange {
  from: number;
  to: number;
  mention: GenerationPromptReferenceMention;
}

export function generationPromptMentionQuery(
  value: string,
  caret: number,
): GenerationPromptMentionQuery | null {
  const before = value.slice(0, caret);
  const match = /(?:^|[\s([{])(@[A-Za-z0-9]*)$/.exec(before);
  if (!match) return null;
  const query = match[1]!;
  return { start: caret - query.length, end: caret, query };
}

export function generationPromptMentionRanges(
  value: string,
  mentions: GenerationPromptReferenceMention[],
): GenerationPromptMentionRange[] {
  const ranges: GenerationPromptMentionRange[] = [];
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

export function generationPromptMentionAtPosition(
  value: string,
  position: number,
  mentions: GenerationPromptReferenceMention[],
): GenerationPromptMentionRange | null {
  return generationPromptMentionRanges(value, mentions).find(
    (range) => position >= range.from && position <= range.to,
  ) ?? null;
}

export function filterGenerationPromptMentions(
  mentions: GenerationPromptReferenceMention[],
  query: string,
): GenerationPromptReferenceMention[] {
  const normalized = query.slice(1).toLocaleLowerCase();
  return mentions.filter((mention) =>
    mention.value.slice(1).toLocaleLowerCase().includes(normalized) ||
    mention.label.toLocaleLowerCase().includes(normalized)
  );
}

function hasMentionBoundaries(value: string, from: number, to: number): boolean {
  const leftBoundary = from === 0 || !/[A-Za-z0-9_]/.test(value[from - 1]!);
  const rightBoundary = to === value.length || !/[A-Za-z0-9_]/.test(value[to]!);
  return leftBoundary && rightBoundary;
}
