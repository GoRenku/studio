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

export function generationPromptMentionQuery(
  value: string,
  caret: number,
): GenerationPromptMentionQuery | null {
  const before = value.slice(0, caret);
  const match = /(?:^|[\s([{])(@[A-Za-z0-9]*)$/.exec(before);
  if (!match) {
    return null;
  }
  const query = match[1]!;
  return { start: caret - query.length, end: caret, query };
}

export function generationPromptMentionAtCaret(
  value: string,
  caret: number,
  mentions: GenerationPromptReferenceMention[],
): GenerationPromptReferenceMention | null {
  return mentions.find((mention) => {
    let start = value.indexOf(mention.value);
    while (start >= 0) {
      const end = start + mention.value.length;
      const leftBoundary = start === 0 || !/[A-Za-z0-9_]/.test(value[start - 1]!);
      const rightBoundary = end === value.length || !/[A-Za-z0-9_]/.test(value[end]!);
      if (leftBoundary && rightBoundary && caret >= start && caret <= end) {
        return true;
      }
      start = value.indexOf(mention.value, end);
    }
    return false;
  }) ?? null;
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
