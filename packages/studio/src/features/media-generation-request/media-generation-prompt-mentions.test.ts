import { describe, expect, it } from 'vitest';
import {
  filterMediaGenerationPromptMentions,
  mediaGenerationPromptMentionQuery,
  mediaGenerationPromptMentionRanges,
  type MediaGenerationPromptMention,
} from './media-generation-prompt-mentions';

const mentions: MediaGenerationPromptMention[] = [
  {
    value: '@Image1',
    accessibleName: 'Opening frame',
    kind: 'image',
    previewImageUrl: '/first-frame.png',
  },
  {
    value: '@Image2',
    accessibleName: 'Closing frame',
    kind: 'image',
    previewImageUrl: '/last-frame.png',
  },
  {
    value: 'Image 1',
    accessibleName: 'MiniMax character reference',
    kind: 'image',
  },
  {
    value: 'Audio 1',
    accessibleName: 'MiniMax dialogue reference',
    kind: 'audio',
  },
  {
    value: '@source-frame',
    accessibleName: 'Authored source frame',
    kind: 'image',
  },
];

describe('media generation prompt mentions', () => {
  it('finds exact flat reference tokens without changing the prompt', () => {
    const prompt = 'Start at @Image1 and finish at @Image2. Keep @Image10 literal.';

    expect(mediaGenerationPromptMentionRanges(prompt, mentions)).toMatchObject([
      { from: 9, to: 16, mention: { value: '@Image1' } },
      { from: 31, to: 38, mention: { value: '@Image2' } },
    ]);
    expect(prompt).toBe('Start at @Image1 and finish at @Image2. Keep @Image10 literal.');
  });

  it('offers deterministic reference tokens after an at-sign', () => {
    expect(mediaGenerationPromptMentionQuery('Use @Im', 7)).toEqual({
      start: 4,
      end: 7,
      query: '@Im',
    });
    expect(mediaGenerationPromptMentionQuery('Use @source-', 12)).toEqual({
      start: 4,
      end: 12,
      query: '@source-',
    });
    expect(filterMediaGenerationPromptMentions(mentions, '@source-')).toEqual([
      mentions[4],
    ]);
    expect(filterMediaGenerationPromptMentions(mentions, '@Image2')).toEqual([
      mentions[1],
    ]);
    expect(filterMediaGenerationPromptMentions(mentions, 'character')).toEqual([
      mentions[2],
    ]);
    expect(filterMediaGenerationPromptMentions(mentions, '@')).toEqual([
      expect.objectContaining({ value: '@Image1' }),
      expect.objectContaining({ value: '@Image2' }),
      expect.objectContaining({ value: '@source-frame' }),
    ]);
  });

  it('decorates exact non-at tokens with spaces and does not invent typed-at discovery', () => {
    expect(mediaGenerationPromptMentionRanges(
      'Match Image 1 while Audio 1 carries the line.',
      mentions,
    )).toMatchObject([
      { mention: { value: 'Image 1' } },
      { mention: { value: 'Audio 1' } },
    ]);
    expect(mediaGenerationPromptMentionQuery('Use Image', 9)).toBeNull();
  });
});
