import { joinProjectRelativePath } from './project-relative-paths.js';

export const VISUAL_LANGUAGE_ROOT = joinProjectRelativePath('visual-language');
export const STORYBOARDS_ROOT = joinProjectRelativePath('storyboards');
export const PROJECT_TMP_ROOT = joinProjectRelativePath('tmp');

export function kebabCasePathSegment(input: string, fallback: string): string {
  const segment = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return segment || fallback;
}
