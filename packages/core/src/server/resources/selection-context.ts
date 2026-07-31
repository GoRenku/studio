import {
  buildDiagnosticResult,
  createDiagnosticError,
} from '@gorenku/studio-diagnostics';
import type {
  StudioSelection,
  StudioSelectionContextResult,
} from '../../client/index.js';
import { ProjectDataError } from '../project-data-error.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  listCastNavigationPage,
  listActNavigationPage,
  listLocationNavigationPage,
  listPropNavigationPage,
  readCastNavigationRow,
  readActNavigationRow,
  readLocationNavigationRow,
  readPropNavigationRow,
  readSceneNavigationContext,
  readSequenceNavigationContext,
} from '../database/access/navigation.js';
import { readLookbookRecordByKind } from '../database/access/lookbook.js';
import { readInspirationFolderRecord } from '../database/access/inspiration-folders.js';
import {
  readActiveSceneBeatSheetRecord,
  readSceneBeatSheetDocument,
} from '../database/access/scene-beat-sheets.js';
import { readShotPlanRecord } from '../database/access/shot-plans/plan-records.js';
import { readShotRecord } from '../database/access/shot-plans/shot-records.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import {
  studioActSurfaceResourceKey,
  studioCastMemberSurfaceResourceKey,
  studioCastNavigationResourceKey,
  studioLocationNavigationResourceKey,
  studioLocationSurfaceResourceKey,
  studioPropNavigationResourceKey,
  studioPropSurfaceResourceKey,
  studioProjectInformationResourceKey,
  studioSequenceScenesNavigationResourceKey,
  studioSequenceSurfaceResourceKey,
  studioSceneShotPlansResourceKey,
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
    return readStudioSelectionContextProjection(session, {
      selection: input.selection,
    });
  } finally {
    session.close();
  }
}

export function readStudioSelectionContextProjection(
  session: DatabaseSession,
  input: { selection: StudioSelection }
): StudioSelectionContextResult {
  const parsed = parseStudioSelection(input.selection, {
    path: ['selection'],
    context: 'movie studio selection',
  });
  if (!parsed.valid) {
    return {
      valid: false,
      reason: 'unsupportedSelection',
      diagnostics: parsed.issues,
    };
  }
  try {
    switch (input.selection.type) {
      case 'projectInformation':
        return {
          valid: true,
          selection: input.selection,
          context: { surface: 'project-information' },
          resourceKeys: [studioProjectInformationResourceKey()],
        };
      case 'inspiration':
        if (
          input.selection.folderId &&
          !readInspirationFolderRecord(session, input.selection.folderId)
        ) {
          return selectionNotFound(input.selection);
        }
        return {
          valid: true,
          selection: input.selection,
          context: { surface: 'visual-language-inspiration' },
          resourceKeys: [studioVisualLanguageInspirationResourceKey()],
        };
      case 'lookbook': {
        const lookbook = readLookbookRecordByKind(session, input.selection.kind);
        return {
          valid: true,
          selection: input.selection,
          context: { surface: 'visual-language-lookbook' },
          resourceKeys: [
            studioVisualLanguageLookbooksResourceKey(),
            ...(lookbook ? [studioVisualLanguageLookbookResourceKey(lookbook.id)] : []),
          ],
        };
      }
      case 'trash':
        return {
          valid: true,
          selection: input.selection,
          context: { surface: 'trash' },
          resourceKeys: [studioTrashResourceKey()],
        };
      case 'cast':
        return {
          valid: true,
          selection: input.selection,
          context: {
            surface: 'cast',
            cast: listCastNavigationPage(session, {}),
          },
          resourceKeys: [studioCastNavigationResourceKey()],
        };
      case 'castMember': {
        const castMember = readCastNavigationRow(session, input.selection.id);
        return castMember
          ? {
              valid: true,
              selection: input.selection,
              context: {
                surface: 'cast-member',
                castMember,
              },
              resourceKeys: [studioCastMemberSurfaceResourceKey(castMember.id)],
            }
          : selectionNotFound(input.selection);
      }
      case 'locations':
        return {
          valid: true,
          selection: input.selection,
          context: {
            surface: 'locations',
            locations: listLocationNavigationPage(session, {}),
          },
          resourceKeys: [studioLocationNavigationResourceKey()],
        };
      case 'location': {
        const location = readLocationNavigationRow(session, input.selection.id);
        return location
          ? {
              valid: true,
              selection: input.selection,
              context: { surface: 'location', location },
              resourceKeys: [studioLocationSurfaceResourceKey(location.id)],
            }
          : selectionNotFound(input.selection);
      }
      case 'props':
        return {
          valid: true,
          selection: input.selection,
          context: {
            surface: 'props',
            props: listPropNavigationPage(session, {}),
          },
          resourceKeys: [studioPropNavigationResourceKey()],
        };
      case 'prop': {
        const prop = readPropNavigationRow(session, input.selection.id);
        return prop
          ? {
              valid: true,
              selection: input.selection,
              context: { surface: 'prop', prop },
              resourceKeys: [studioPropSurfaceResourceKey(prop.id)],
            }
          : selectionNotFound(input.selection);
      }
      case 'storyArc':
        return {
          valid: true,
          selection: input.selection,
          context: {
            surface: 'story-arc',
            acts: listActNavigationPage(session, {}),
          },
          resourceKeys: [studioStoryArcSurfaceResourceKey()],
        };
      case 'act': {
        const act = readActNavigationRow(session, input.selection.id);
        return act
          ? {
              valid: true,
              selection: input.selection,
              context: { surface: 'act', act },
              resourceKeys: [studioActSurfaceResourceKey(act.id)],
            }
          : selectionNotFound(input.selection);
      }
      case 'sequence': {
        const chain = readSequenceNavigationContext(session, input.selection.id);
        const act = chain ? readActNavigationRow(session, chain.sequence.actId) : null;
        return chain && act
          ? {
              valid: true,
              selection: input.selection,
              context: {
                surface: 'sequence',
                act,
                sequence: chain.sequence,
              },
              resourceKeys: [studioSequenceSurfaceResourceKey(chain.sequence.id)],
            }
          : selectionNotFound(input.selection);
      }
      case 'scene': {
        const chain = readSceneNavigationContext(session, input.selection.id);
        const act = chain ? readActNavigationRow(session, chain.sequence.actId) : null;
        if (
          chain &&
          input.selection.beatId &&
          !sceneBeatExists(session, input.selection.id, input.selection.beatId)
        ) {
          return selectionNotFound(input.selection);
        }
        if (
          chain &&
          input.selection.shotPlanId &&
          !sceneShotPlanFocusExists(session, input.selection)
        ) {
          return selectionNotFound(input.selection);
        }
        return chain && act
          ? {
              valid: true,
              selection: input.selection,
              context: {
                surface: 'scene',
                act,
                scene: chain.scene,
                sequence: chain.sequence,
              },
              resourceKeys: [
                studioSequenceScenesNavigationResourceKey(chain.sequence.id),
                ...(input.selection.sceneTab === 'shotPlans'
                  ? [studioSceneShotPlansResourceKey(input.selection.id)]
                  : []),
              ],
            }
          : selectionNotFound(input.selection);
      }
    }
  } catch (error) {
    if (error instanceof ProjectDataError && error.code === 'PROJECT_DATA114') {
      return selectionNotFound(input.selection);
    }
    throw error;
  }
}

function sceneShotPlanFocusExists(
  session: DatabaseSession,
  selection: Extract<StudioSelection, { type: 'scene' }>
): boolean {
  const plan = selection.shotPlanId
    ? readShotPlanRecord(session, selection.shotPlanId)
    : null;
  if (!plan || plan.sceneId !== selection.id) {
    return false;
  }
  if (!selection.shotId) {
    return true;
  }
  const shot = readShotRecord(session, selection.shotId);
  return shot?.shotPlanId === plan.id;
}

function sceneBeatExists(
  session: DatabaseSession,
  sceneId: string,
  beatId: string
): boolean {
  const activeBeatSheet = readActiveSceneBeatSheetRecord(session, sceneId);
  const screenplay = readScreenplayDocumentFromSession(session);
  if (!activeBeatSheet || !screenplay) {
    return false;
  }
  const document = readSceneBeatSheetDocument({
    row: activeBeatSheet,
    screenplay,
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
        'Refresh Studio or choose an existing project item.'
      ),
    ]).issues,
  };
}
