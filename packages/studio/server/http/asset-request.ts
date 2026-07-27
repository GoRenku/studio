import {
  createDiagnosticError,
  createStructuredError,
} from '@gorenku/studio-diagnostics';
import type { AssetOwner } from '@gorenku/studio-core/server';
import {
  readOptionalQueryString,
  readPageRequest,
} from './pagination-request.js';

export function readAssetPageRequest(
  query: Record<string, string | undefined>
): {
  owner: AssetOwner;
  type?: string;
  mediaKind?: string;
  locale?: { localeId: string | null };
  limit?: number;
  cursor?: string;
} {
  return {
    owner: readAssetOwnerQuery(query),
    type: readOptionalQueryString(query.type),
    mediaKind: readOptionalQueryString(query.mediaKind),
    locale:
      query.localeId === undefined
        ? undefined
        : { localeId: query.localeId === '' ? null : query.localeId },
    ...readPageRequest(query),
  };
}

function readAssetOwnerQuery(
  query: Record<string, string | undefined>
): AssetOwner {
  switch (query.ownerKind) {
    case 'project':
      return { kind: 'project' };
    case 'castMember':
    case 'location':
    case 'sequence':
    case 'scene':
    case 'lookbook':
    case 'shot':
      return {
        kind: query.ownerKind,
        id: readRequiredOwnerId(query.ownerId, query.ownerKind),
      };
    case 'sceneBeat':
      return {
        kind: 'sceneBeat',
        sceneId: readRequiredOwnerId(query.sceneId, 'sceneBeat scene'),
        beatId: readRequiredOwnerId(query.beatId, 'sceneBeat Beat'),
      };
    default:
      throw createStructuredError({
        code: 'STUDIO_SERVER032',
        message: 'Unsupported Asset owner kind.',
        issues: [
          createDiagnosticError(
            'STUDIO_SERVER032',
            'ownerKind must name a supported Asset owner.',
            { path: ['ownerKind'] },
            'Use project, castMember, location, sequence, scene, sceneBeat, lookbook, or shot.'
          ),
        ],
        suggestion:
          'Use a supported Asset owner kind and its required identifier fields.',
      });
  }
}

function readRequiredOwnerId(
  ownerId: string | undefined,
  ownerKind: string
): string {
  const id = readOptionalQueryString(ownerId);
  if (id) {
    return id;
  }
  throw createStructuredError({
    code: 'STUDIO_SERVER033',
    message: `An identifier is required for ${ownerKind} Asset pages.`,
    issues: [
      createDiagnosticError(
        'STUDIO_SERVER033',
        `An identifier is required for ${ownerKind} Asset pages.`,
        { path: ['ownerId'] },
        'Send the identifier for this Asset owner.'
      ),
    ],
    suggestion: 'Send the identifier for this Asset owner.',
  });
}
