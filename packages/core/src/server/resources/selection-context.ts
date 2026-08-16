import { buildDiagnosticResult, createDiagnosticError } from '@gorenku/studio-diagnostics';
import type { StudioSelection, StudioSelectionContextResult } from '../../client/index.js';
import { listCastNavigationPage, listLocationNavigationPage, listPropNavigationPage } from '../database/access/navigation.js';
import { readActiveSceneBeatsRevisionRecord, readSceneBeats } from '../database/access/scene-beats.js';
import { readShotPlanRecord } from '../database/access/shot-plans/plan-records.js';
import { readShotRecord } from '../database/access/shot-plans/shot-records.js';
import { readLookbookRecordByKind } from '../database/access/lookbook.js';
import { readInspirationFolderRecord } from '../database/access/inspiration-folders.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { readCanonicalScreenplay } from '../screenplay/projections/screenplay.js';
import { projectScreenplayScene } from '../screenplay/projections/scene.js';
import {
  studioCastMemberSurfaceResourceKey,
  studioCastNavigationResourceKey,
  studioLocationNavigationResourceKey,
  studioLocationSurfaceResourceKey,
  studioProjectInformationResourceKey,
  studioPropNavigationResourceKey,
  studioPropSurfaceResourceKey,
  studioSceneNarrativeResourceKey,
  studioSceneShotPlansResourceKey,
  studioScreenplayStructureResourceKey,
  studioStoryArcSurfaceResourceKey,
  studioTrashResourceKey,
  studioVisualLanguageInspirationResourceKey,
  studioVisualLanguageLookbookResourceKey,
  studioVisualLanguageLookbooksResourceKey,
} from '../studio-coordination/resource-keys.js';
import { parseStudioSelection } from '../studio-coordination/selection-validation.js';

export async function readStudioSelectionContext(input: {
  projectName: string;
  selection: StudioSelection;
  homeDir?: string;
}): Promise<StudioSelectionContextResult> {
  const { session } = await openProjectSession(input);
  try {
    return readStudioSelectionContextProjection(session, { selection: input.selection });
  } finally {
    session.close();
  }
}

export function readStudioSelectionContextProjection(
  session: DatabaseSession,
  input: { selection: StudioSelection },
): StudioSelectionContextResult {
  const parsed = parseStudioSelection(input.selection, {
    path: ['selection'],
    context: 'movie studio selection',
  });
  if (!parsed.valid) {
    return { valid: false, reason: 'unsupportedSelection', diagnostics: parsed.issues };
  }
  const selection = input.selection;
  switch (selection.type) {
    case 'projectInformation':
      return found(selection, { surface: 'project-information' }, [studioProjectInformationResourceKey()]);
    case 'screenplay':
      return found(selection, { surface: 'screenplay' }, [studioScreenplayStructureResourceKey()]);
    case 'inspiration':
      return selection.folderId && !readInspirationFolderRecord(session, selection.folderId)
        ? selectionNotFound(selection)
        : found(selection, { surface: 'visual-language-inspiration' }, [studioVisualLanguageInspirationResourceKey()]);
    case 'lookbook': {
      const lookbook = readLookbookRecordByKind(session, selection.kind);
      return found(selection, { surface: 'visual-language-lookbook' }, [
        studioVisualLanguageLookbooksResourceKey(),
        ...(lookbook ? [studioVisualLanguageLookbookResourceKey(lookbook.id)] : []),
      ]);
    }
    case 'trash':
      return found(selection, { surface: 'trash' }, [studioTrashResourceKey()]);
    case 'cast':
      return found(selection, { surface: 'cast', cast: listCastNavigationPage(session, {}) }, [studioCastNavigationResourceKey()]);
    case 'castMember': {
      const castMember = listCastNavigationPage(session, { limit: 200 }).items.find((item) => item.id === selection.id);
      return castMember
        ? found(selection, { surface: 'cast-member', castMember }, [studioCastMemberSurfaceResourceKey(castMember.id)])
        : selectionNotFound(selection);
    }
    case 'locations':
      return found(selection, { surface: 'locations', locations: listLocationNavigationPage(session, {}) }, [studioLocationNavigationResourceKey()]);
    case 'location': {
      const location = listLocationNavigationPage(session, { limit: 200 }).items.find((item) => item.id === selection.id);
      return location
        ? found(selection, { surface: 'location', location }, [studioLocationSurfaceResourceKey(location.id)])
        : selectionNotFound(selection);
    }
    case 'props':
      return found(selection, { surface: 'props', props: listPropNavigationPage(session, {}) }, [studioPropNavigationResourceKey()]);
    case 'prop': {
      const prop = listPropNavigationPage(session, { limit: 200 }).items.find((item) => item.id === selection.id);
      return prop
        ? found(selection, { surface: 'prop', prop }, [studioPropSurfaceResourceKey(prop.id)])
        : selectionNotFound(selection);
    }
    case 'storyArc':
      return found(selection, { surface: 'story-arc' }, [studioStoryArcSurfaceResourceKey()]);
    case 'scene': {
      const screenplay = readCanonicalScreenplay(session);
      const scene = screenplay.scenes.some((candidate) => candidate.id === selection.id)
        ? projectScreenplayScene(screenplay, selection.id)
        : null;
      if (!scene || (selection.beatId && !sceneBeatExists(session, selection.id, selection.beatId))) {
        return selectionNotFound(selection);
      }
      if (selection.shotPlanId && !sceneShotPlanFocusExists(session, selection)) {
        return selectionNotFound(selection);
      }
      return found(selection, { surface: 'scene', scene }, [
        studioSceneNarrativeResourceKey(selection.id),
        ...(selection.sceneTab === 'shotPlans' ? [studioSceneShotPlansResourceKey(selection.id)] : []),
      ]);
    }
  }
}

function found(
  selection: StudioSelection,
  context: Extract<StudioSelectionContextResult, { valid: true }>['context'],
  resourceKeys: string[],
): StudioSelectionContextResult {
  return { valid: true, selection, context, resourceKeys };
}

function sceneShotPlanFocusExists(
  session: DatabaseSession,
  selection: Extract<StudioSelection, { type: 'scene' }>,
): boolean {
  const plan = selection.shotPlanId ? readShotPlanRecord(session, selection.shotPlanId) : null;
  if (!plan || plan.sceneId !== selection.id) {
    return false;
  }
  if (!selection.shotId) {
    return true;
  }
  return readShotRecord(session, selection.shotId)?.shotPlanId === plan.id;
}

function sceneBeatExists(session: DatabaseSession, sceneId: string, beatId: string): boolean {
  const activeRevision = readActiveSceneBeatsRevisionRecord(session, sceneId);
  if (!activeRevision) {
    return false;
  }
  const document = readSceneBeats({
    row: activeRevision,
  });
  return document.beats.some((beat) => beat.id === beatId);
}

function selectionNotFound(selection: StudioSelection): StudioSelectionContextResult {
  return {
    valid: false,
    reason: 'selectionNotFound',
    diagnostics: buildDiagnosticResult([
      createDiagnosticError(
        'PROJECT_DATA119',
        'Movie Studio selection was not found in the selected project.',
        { path: [], context: 'movie studio selection' },
        'Refresh Studio or choose an existing project item.',
      ),
    ]).issues,
  };
}
