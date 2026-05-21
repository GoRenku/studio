import {
  createDiagnosticError,
  createStructuredError,
} from '@gorenku/studio-diagnostics';
import type { AssetTarget } from '@gorenku/studio-core/server';
import {
  readOptionalQueryString,
  readPageRequest,
} from './pagination-request.js';

export function readAssetPageRequest(
  query: Record<string, string | undefined>
): {
  target: AssetTarget;
  role?: string;
  mediaKind?: string;
  selection?: 'take' | 'select';
  locale?: { localeId: string | null };
  limit?: number;
  cursor?: string;
} {
  return {
    target: readAssetTargetQuery(query),
    role: readOptionalQueryString(query.role),
    mediaKind: readOptionalQueryString(query.mediaKind),
    selection: readAssetSelectionQuery(query.selection),
    locale:
      query.localeId === undefined
        ? undefined
        : { localeId: query.localeId === '' ? null : query.localeId },
    ...readPageRequest(query),
  };
}

function readAssetSelectionQuery(
  value: string | undefined
): 'take' | 'select' | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }
  if (value === 'take' || value === 'select') {
    return value;
  }
  throw createStructuredError({
    code: 'STUDIO_SERVER031',
    message: 'Unsupported asset selection filter.',
    issues: [
      createDiagnosticError(
        'STUDIO_SERVER031',
        'Asset selection must be take or select.',
        { path: ['selection'] },
        'Use selection=take or selection=select.'
      ),
    ],
    suggestion: 'Use selection=take or selection=select.',
  });
}

function readAssetTargetQuery(
  query: Record<string, string | undefined>
): AssetTarget {
  switch (query.targetKind) {
    case 'project':
      return { kind: 'project' };
    case 'visualLanguage':
      return {
        kind: 'visualLanguage',
        visualLanguageId: readRequiredTargetId(query.targetId, query.targetKind),
      };
    case 'castMember':
      return {
        kind: 'castMember',
        castMemberId: readRequiredTargetId(query.targetId, query.targetKind),
      };
    case 'sequence':
      return {
        kind: 'sequence',
        sequenceId: readRequiredTargetId(query.targetId, query.targetKind),
      };
    case 'scene':
      return {
        kind: 'scene',
        sceneId: readRequiredTargetId(query.targetId, query.targetKind),
      };
    default:
      throw createStructuredError({
        code: 'STUDIO_SERVER032',
        message: 'Unsupported asset target kind.',
        issues: [
          createDiagnosticError(
            'STUDIO_SERVER032',
            'targetKind must name a supported asset target.',
            { path: ['targetKind'] },
            'Use project, visualLanguage, castMember, sequence, or scene.'
          ),
        ],
        suggestion: 'Use project, visualLanguage, castMember, sequence, or scene.',
      });
  }
}

function readRequiredTargetId(
  targetId: string | undefined,
  targetKind: string
): string {
  const id = readOptionalQueryString(targetId);
  if (id) {
    return id;
  }
  throw createStructuredError({
    code: 'STUDIO_SERVER033',
    message: `targetId is required for ${targetKind} asset pages.`,
    issues: [
      createDiagnosticError(
        'STUDIO_SERVER033',
        `targetId is required for ${targetKind} asset pages.`,
        { path: ['targetId'] },
        'Send the target id for this asset page.'
      ),
    ],
    suggestion: 'Send the target id for this asset page.',
  });
}
