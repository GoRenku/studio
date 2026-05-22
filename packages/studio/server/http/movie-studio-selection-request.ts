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
    (type === 'sequence' ||
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
  return {
    selection: studioSelectionFromRequest(type, id),
  };
}

function isStudioSelectionType(
  type: string
): type is StudioSelection['type'] {
  return (
    type === 'projectInformation' ||
    type === 'visualLanguage' ||
    type === 'cast' ||
    type === 'locations' ||
    type === 'storyArc' ||
    type === 'sequence' ||
    type === 'scene' ||
    type === 'castMember' ||
    type === 'location'
  );
}

function studioSelectionFromRequest(
  type: StudioSelection['type'],
  id: string | undefined
): StudioSelection {
  switch (type) {
    case 'sequence':
    case 'scene':
    case 'castMember':
    case 'location':
      return { type, id: id as string };
    case 'projectInformation':
    case 'visualLanguage':
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
