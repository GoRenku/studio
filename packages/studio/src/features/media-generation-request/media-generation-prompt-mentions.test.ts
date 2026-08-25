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
    accessibleName: 'scenes/02/first-frame.png',
    kind: 'image',
    previewImageUrl: '/first-frame.png',
  },
  {
    value: '@Image2',
    accessibleName: 'scenes/02/last-frame.png',
    kind: 'image',
    previewImageUrl: '/last-frame.png',
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
    expect(filterMediaGenerationPromptMentions(mentions, '@Image2')).toEqual([
      mentions[1],
    ]);
  });
});
