import { ProjectDataError } from '../../project-data-error.js';

export const FDX_LIMITS = {
  sourceBytes: 10 * 1024 * 1024,
  xmlDepth: 64,
  paragraphCount: 25_000,
  attributesPerElement: 64,
  attributeCharacters: 16_384,
  paragraphTextCharacters: 100_000,
  semanticTextCharacters: 5_000_000,
} as const;

export function fdxLimitExceeded(limit: string): ProjectDataError {
  return new ProjectDataError(
    'SCREENPLAY_FDX_LIMIT_EXCEEDED',
    `FDX source exceeds the supported ${limit} limit.`,
  );
}
