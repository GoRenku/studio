import { describe, expect, it } from 'vitest';
import {
  filterGenerationPromptMentions,
  generationPromptMentionAtPosition,
  generationPromptMentionQuery,
  generationPromptMentionRanges,
  type GenerationPromptReferenceMention,
} from './prompt-mentions';

const mentions: GenerationPromptReferenceMention[] = [
  { value: '@Reference1', label: 'Council chamber', previewImageUrl: '/one.png' },
  { value: '@Reference2', label: 'Production lookbook', previewImageUrl: '/two.png' },
];

describe('prompt mentions', () => {
  it.each([
    ['@', 1, { start: 0, end: 1, query: '@' }],
    ['Use @Ref', 8, { start: 4, end: 8, query: '@Ref' }],
    ['(@Reference1', 12, { start: 1, end: 12, query: '@Reference1' }],
    ['email@Ref', 9, null],
    ['Use @Ref later', 8, { start: 4, end: 8, query: '@Ref' }],
  ])('finds accepted query boundaries in %s', (value, caret, expected) => {
    expect(generationPromptMentionQuery(value, caret)).toEqual(expected);
  });

  it('filters by mention value and meaningful title', () => {
    expect(filterGenerationPromptMentions(mentions, '@2')).toEqual([mentions[1]]);
    expect(filterGenerationPromptMentions(mentions, '@council')).toEqual([mentions[0]]);
    expect(filterGenerationPromptMentions(mentions, '@LOOK')).toEqual([mentions[1]]);
    expect(filterGenerationPromptMentions(mentions, '@missing')).toEqual([]);
  });

  it('returns every repeated exact known mention range and ignores unknown or embedded text', () => {
    const value = '@Reference1, @Unknown, x@Reference1, @Reference1.';
    expect(generationPromptMentionRanges(value, mentions)).toEqual([
      { from: 0, to: 11, mention: mentions[0] },
      { from: 37, to: 48, mention: mentions[0] },
    ]);
  });

  it('looks up known mentions at start, middle, and end boundaries', () => {
    const value = 'Use @Reference1 now.';
    expect(generationPromptMentionAtPosition(value, 4, mentions)?.mention)
      .toEqual(mentions[0]);
    expect(generationPromptMentionAtPosition(value, 9, mentions)?.mention)
      .toEqual(mentions[0]);
    expect(generationPromptMentionAtPosition(value, 15, mentions)?.mention)
      .toEqual(mentions[0]);
    expect(generationPromptMentionAtPosition(value, 16, mentions)).toBeNull();
  });

  it('uses normalized CodeMirror offsets after CRLF-authored line breaks', () => {
    const normalizedDocument = 'First\nSecond\nUse @Ref and @Reference2.';
    const queryCaret = normalizedDocument.indexOf('@Ref') + 4;
    expect(generationPromptMentionQuery(normalizedDocument, queryCaret)).toEqual({
      start: 17,
      end: 21,
      query: '@Ref',
    });
    expect(generationPromptMentionRanges(normalizedDocument, mentions)).toEqual([
      { from: 26, to: 37, mention: mentions[1] },
    ]);
    expect(normalizedDocument.replaceAll('\n', '\r\n').indexOf('@Reference2')).toBe(28);
  });
});
