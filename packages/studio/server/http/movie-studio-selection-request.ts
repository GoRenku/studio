import type {
  ScenePanelTab,
  StudioSelection,
} from '@gorenku/studio-core/server';
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

const SCENE_PANEL_TABS: ScenePanelTab[] = ['narrative', 'beats', 'shots'];

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
  const kind =
    selection.kind === 'production' || selection.kind === 'storyboard'
      ? selection.kind
      : undefined;
  const beatId =
    typeof selection.beatId === 'string' && selection.beatId.trim()
      ? selection.beatId.trim()
      : undefined;
  const sceneTab =
    typeof selection.sceneTab === 'string' && selection.sceneTab.trim()
      ? selection.sceneTab.trim()
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
  if (type === 'lookbook' && !kind) {
    throwMovieStudioSelectionRequestError([
      createDiagnosticError(
        'STUDIO_SERVER034',
        'selection.kind is required for Lookbook selections.',
        { path: ['selection', 'kind'] },
        'Send production or storyboard.'
      ),
    ]);
  }
  if (type === 'scene' && sceneTab && !SCENE_PANEL_TABS.includes(sceneTab as ScenePanelTab)) {
    throwMovieStudioSelectionRequestError([
      createDiagnosticError(
        'STUDIO_SERVER034',
        `Unsupported scene tab: ${sceneTab}.`,
        { path: ['selection', 'sceneTab'] },
        'Send a supported scene tab.'
      ),
    ]);
  }
  return {
    selection: studioSelectionFromRequest(type, {
      id,
      folderId,
      kind,
      beatId,
      sceneTab: sceneTab as ScenePanelTab | undefined,
    }),
  };
}

function isStudioSelectionType(
  type: string
): type is StudioSelection['type'] {
  return (
    type === 'projectInformation' ||
    type === 'inspiration' ||
    type === 'lookbook' ||
    type === 'trash' ||
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
  ids: {
    id?: string;
    folderId?: string;
    kind?: 'production' | 'storyboard';
    beatId?: string;
    sceneTab?: ScenePanelTab;
  }
): StudioSelection {
  switch (type) {
    case 'scene':
      return {
        type,
        id: ids.id as string,
        ...(ids.sceneTab ? { sceneTab: ids.sceneTab } : {}),
        ...(ids.beatId ? { beatId: ids.beatId } : {}),
      };
    case 'act':
    case 'sequence':
    case 'castMember':
    case 'location':
      return { type, id: ids.id as string };
    case 'lookbook':
      return { type, kind: ids.kind as 'production' | 'storyboard' };
    case 'projectInformation':
    case 'inspiration':
      return ids.folderId ? { type, folderId: ids.folderId } : { type };
    case 'cast':
    case 'locations':
    case 'storyArc':
    case 'trash':
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
