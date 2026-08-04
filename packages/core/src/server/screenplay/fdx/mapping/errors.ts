import { ProjectDataError } from '../../../project-data-error.js';
import type { FdxParagraph } from '../parser/types.js';

export function invalidFdxParagraph(
  paragraph: FdxParagraph,
  value: string,
): ProjectDataError {
  const code = paragraph.type === 'Character'
    || paragraph.type === 'Dialogue'
    || paragraph.type === 'Parenthetical'
    ? 'SCREENPLAY_FDX_INVALID_DIALOGUE'
    : paragraph.type === 'New Act'
      || paragraph.type === 'Sequence'
      || paragraph.type === 'End of Act'
      ? 'SCREENPLAY_FDX_INVALID_SECTION_STRUCTURE'
      : 'SCREENPLAY_FDX_UNSUPPORTED_VISIBLE_CONTENT';
  return invalidFdxAt(paragraph.path, `${paragraph.type}: ${value}`, code);
}

export function invalidFdxAt(
  path: string,
  value: string,
  code = 'SCREENPLAY_FDX_INVALID_DIALOGUE',
): ProjectDataError {
  return new ProjectDataError(
    code,
    `Unsupported FDX content at ${path}: ${value}.`,
  );
}
