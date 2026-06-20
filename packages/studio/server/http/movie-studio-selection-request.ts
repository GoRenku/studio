import type {
  ScenePanelTab,
  SceneShotDetailTab,
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

const SCENE_PANEL_TABS: ScenePanelTab[] = ['narrative', 'shots', 'takes'];
const SCENE_SHOT_DETAIL_TABS: SceneShotDetailTab[] = [
  'description',
  'lookbook',
  'composition',
  'motion',
  'cast',
  'location',
  'dialogs',
  'references',
  'ai-production',
];

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
  const takeWorkspaceMode =
    selection.takeWorkspaceMode === 'list' ||
    selection.takeWorkspaceMode === 'new' ||
    selection.takeWorkspaceMode === 'edit'
      ? selection.takeWorkspaceMode
      : undefined;
  const takeId =
    typeof selection.takeId === 'string' &&
    selection.takeId.trim()
      ? selection.takeId.trim()
      : undefined;
  const sceneTab =
    typeof selection.sceneTab === 'string' && selection.sceneTab.trim()
      ? selection.sceneTab.trim()
      : undefined;
  const shotTab =
    typeof selection.shotTab === 'string' && selection.shotTab.trim()
      ? selection.shotTab.trim()
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
  if (type === 'scene' && shotTab && !SCENE_SHOT_DETAIL_TABS.includes(shotTab as SceneShotDetailTab)) {
    throwMovieStudioSelectionRequestError([
      createDiagnosticError(
        'STUDIO_SERVER034',
        `Unsupported shot tab: ${shotTab}.`,
        { path: ['selection', 'shotTab'] },
        'Send a supported shot tab.'
      ),
    ]);
  }
  return {
    selection: studioSelectionFromRequest(type, {
      id,
      folderId,
      lookbookId,
      shotId,
      takeWorkspaceMode,
      takeId,
      sceneTab: sceneTab as ScenePanelTab | undefined,
      shotTab: shotTab as SceneShotDetailTab | undefined,
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
    lookbookId?: string;
    shotId?: string;
    takeWorkspaceMode?: 'list' | 'new' | 'edit';
    takeId?: string;
    sceneTab?: ScenePanelTab;
    shotTab?: SceneShotDetailTab;
  }
): StudioSelection {
  switch (type) {
    case 'scene':
      return {
        type,
        id: ids.id as string,
        ...(ids.sceneTab ? { sceneTab: ids.sceneTab } : {}),
        ...(ids.shotId ? { shotId: ids.shotId } : {}),
        ...(ids.takeWorkspaceMode
          ? { takeWorkspaceMode: ids.takeWorkspaceMode }
          : {}),
        ...(ids.takeId
          ? { takeId: ids.takeId }
          : {}),
        ...(ids.shotTab ? { shotTab: ids.shotTab } : {}),
      };
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
