import { describe, expect, it } from 'vitest';
import {
  filterGenerationPromptMentions,
  generationPromptMentionAtCaret,
  generationPromptMentionQuery,
  type GenerationPromptReferenceMention,
} from './generation-request-prompt-mentions';

const mentions: GenerationPromptReferenceMention[] = [
  { value: '@Reference1', label: 'Council chamber', previewImageUrl: '/one.png' },
  { value: '@Reference2', label: 'Production lookbook', previewImageUrl: '/two.png' },
];

describe('generation request prompt mentions', () => {
  it('finds the exact active query range after @ and partial text', () => {
    expect(generationPromptMentionQuery('Use @Ref', 8)).toEqual({
      start: 4,
      end: 8,
      query: '@Ref',
    });
    expect(generationPromptMentionQuery('email@Ref', 9)).toBeNull();
  });

  it('filters by exact mention or meaningful reference title', () => {
    expect(filterGenerationPromptMentions(mentions, '@2')).toEqual([mentions[1]]);
    expect(filterGenerationPromptMentions(mentions, '@council')).toEqual([mentions[0]]);
  });

  it('previews only known exact mentions at the caret', () => {
    const value = 'Use @Reference1, but leave @Unknown unchanged.';
    expect(generationPromptMentionAtCaret(value, 8, mentions)).toEqual(mentions[0]);
    expect(generationPromptMentionAtCaret(value, 35, mentions)).toBeNull();
  });
});
