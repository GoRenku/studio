import type { StudioSelection } from '@gorenku/studio-core/server';
import {
  buildDiagnosticResult,
  createDiagnosticError,
  createStructuredError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import {
  readHttpRequestRecord,
  readRequiredHttpString,
} from './request-validation.js';

export function readMovieStudioSelectionRequest(input: unknown): {
  selection: StudioSelection;
} {
  const context = 'movie studio selection context request';
  const issues: DiagnosticIssue[] = [];
  const record = readHttpRequestRecord(input, [], issues, context);
  if (!record) {
    throwMovieStudioSelectionRequestError(issues);
  }
  const selection = readHttpRequestRecord(
    record.selection,
    ['selection'],
    issues,
    context
  );
  if (!selection) {
    throwMovieStudioSelectionRequestError(issues);
  }
  const type = readRequiredHttpString(
    selection,
    ['selection', 'type'],
    issues,
    context
  );
  const id =
    typeof selection.id === 'string' && selection.id.trim()
      ? selection.id.trim()
      : undefined;
  const folderId =
    typeof selection.folderId === 'string' && selection.folderId.trim()
      ? selection.folderId.trim()
      : undefined;
  const lookbookId =
    typeof selection.lookbookId === 'string' && selection.lookbookId.trim()
      ? selection.lookbookId.trim()
      : undefined;
  const shotId =
    typeof selection.shotId === 'string' && selection.shotId.trim()
      ? selection.shotId.trim()
      : undefined;
  const result = buildDiagnosticResult(issues);
  if (!result.valid || type === null) {
    throwMovieStudioSelectionRequestError(result.issues);
  }
  if (!isStudioSelectionType(type)) {
    throwMovieStudioSelectionRequestError([
      createDiagnosticError(
        'STUDIO_SERVER034',
        `Unsupported Movie Studio selection type: ${type}.`,
        { path: ['selection', 'type'] },
        'Send a supported Movie Studio selection type.'
      ),
    ]);
  }
  if (
    (type === 'act' ||
      type === 'sequence' ||
      type === 'scene' ||
      type === 'castMember' ||
      type === 'location') &&
    !id
  ) {
    throwMovieStudioSelectionRequestError([
      createDiagnosticError(
        'STUDIO_SERVER034',
        `selection.id is required for ${type} selections.`,
        { path: ['selection', 'id'] },
        'Send the selected entity id.'
      ),
    ]);
  }
  if (type === 'lookbook' && !lookbookId) {
    throwMovieStudioSelectionRequestError([
      createDiagnosticError(
        'STUDIO_SERVER034',
        'selection.lookbookId is required for lookbook selections.',
        { path: ['selection', 'lookbookId'] },
        'Send the selected Lookbook id.'
      ),
    ]);
  }
  return {
    selection: studioSelectionFromRequest(type, {
      id,
      folderId,
      lookbookId,
      shotId,
    }),
  };
}

function isStudioSelectionType(
  type: string
): type is StudioSelection['type'] {
  return (
    type === 'projectInformation' ||
    type === 'inspiration' ||
    type === 'lookbooks' ||
    type === 'lookbook' ||
    type === 'cast' ||
    type === 'locations' ||
    type === 'storyArc' ||
    type === 'act' ||
    type === 'sequence' ||
    type === 'scene' ||
    type === 'castMember' ||
    type === 'location'
  );
}

function studioSelectionFromRequest(
  type: StudioSelection['type'],
  ids: { id?: string; folderId?: string; lookbookId?: string; shotId?: string }
): StudioSelection {
  switch (type) {
    case 'scene':
      return ids.shotId
        ? { type, id: ids.id as string, shotId: ids.shotId }
        : { type, id: ids.id as string };
    case 'act':
    case 'sequence':
    case 'castMember':
    case 'location':
      return { type, id: ids.id as string };
    case 'lookbook':
      return { type, lookbookId: ids.lookbookId as string };
    case 'projectInformation':
    case 'inspiration':
      return ids.folderId ? { type, folderId: ids.folderId } : { type };
    case 'lookbooks':
    case 'cast':
    case 'locations':
    case 'storyArc':
      return { type };
  }
}

function throwMovieStudioSelectionRequestError(
  issues: DiagnosticIssue[]
): never {
  throw createStructuredError({
    code: 'STUDIO_SERVER034',
    message: 'Invalid movie studio selection context request.',
    issues,
    suggestion: 'Send a supported Movie Studio selection object.',
  });
}
