import { describe, expect, it } from 'vitest';
import { suggestProjectName } from './project-name-suggestion';

describe('suggestProjectName', () => {
  it.each([
    ['The Glass Harbor', 'the-glass-harbor'],
    ["L'été à Cádiz", 'l-ete-a-cadiz'],
    ['  Chapter 12: Home / Away  ', 'chapter-12-home-away'],
    ['Project 2049', 'project-2049'],
    ['---Already---Separated---', 'already-separated'],
    ['東京', ''],
  ])('suggests %j as %j', (title, expected) => {
    expect(suggestProjectName(title)).toBe(expected);
  });
});
