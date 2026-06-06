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
  readCastNavigationRow,
  readActNavigationRow,
  readLocationNavigationRow,
  readSceneNavigationContext,
  readSequenceNavigationContext,
} from '../database/access/navigation.js';
import { readLookbookRecordById } from '../database/access/lookbook.js';
import { readInspirationFolderRecord } from '../database/access/inspiration-folders.js';
import {
  readActiveSceneShotListRecord,
  readSceneShotListDocument,
} from '../database/access/scene-shot-lists.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';

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
  try {
    switch (input.selection.type) {
      case 'projectInformation':
        return {
          valid: true,
          selection: input.selection,
          context: { surface: 'project-information' },
          resourceKeys: ['project-information'],
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
          resourceKeys: ['surface:visual-language:inspiration'],
        };
      case 'lookbooks':
        return {
          valid: true,
          selection: input.selection,
          context: { surface: 'visual-language-lookbooks' },
          resourceKeys: ['surface:visual-language:lookbooks'],
        };
      case 'lookbook': {
        const lookbook = readLookbookRecordById(session, input.selection.lookbookId);
        return lookbook
          ? {
              valid: true,
              selection: input.selection,
              context: { surface: 'visual-language-lookbook' },
              resourceKeys: [`surface:visual-language:lookbook:${lookbook.id}`],
            }
          : selectionNotFound(input.selection);
      }
      case 'cast':
        return {
          valid: true,
          selection: input.selection,
          context: {
            surface: 'cast',
            cast: listCastNavigationPage(session, {}),
          },
          resourceKeys: ['navigation:cast'],
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
              resourceKeys: [`surface:castMember:${castMember.id}`],
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
          resourceKeys: ['navigation:locations'],
        };
      case 'location': {
        const location = readLocationNavigationRow(session, input.selection.id);
        return location
          ? {
              valid: true,
              selection: input.selection,
              context: { surface: 'location', location },
              resourceKeys: [`surface:location:${location.id}`],
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
          resourceKeys: ['surface:story-arc'],
        };
      case 'act': {
        const act = readActNavigationRow(session, input.selection.id);
        return act
          ? {
              valid: true,
              selection: input.selection,
              context: { surface: 'act', act },
              resourceKeys: [`surface:act:${act.id}`],
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
              resourceKeys: [`surface:sequence:${chain.sequence.id}`],
            }
          : selectionNotFound(input.selection);
      }
      case 'scene': {
        const sceneTabValidation = validateSceneSelectionTabs(input.selection);
        if (sceneTabValidation) {
          return sceneTabValidation;
        }
        const chain = readSceneNavigationContext(session, input.selection.id);
        const act = chain ? readActNavigationRow(session, chain.sequence.actId) : null;
        if (
          chain &&
          input.selection.shotId &&
          !sceneShotExists(session, input.selection.id, input.selection.shotId)
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
              resourceKeys: [`navigation:sequence-scenes:${chain.sequence.id}`],
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

function validateSceneSelectionTabs(
  selection: Extract<StudioSelection, { type: 'scene' }>
): StudioSelectionContextResult | null {
  if (selection.sceneTab === 'narrative' && (selection.shotId || selection.shotTab)) {
    return unsupportedSelection(
      createDiagnosticError(
        'STUDIO_COORDINATION036',
        'Shot focus requires the Shots scene tab.',
        { path: ['selection', 'sceneTab'], context: 'movie studio selection' },
        'Use sceneTab: "shots" when requesting a shot or shot-detail tab.'
      )
    );
  }
  return null;
}

function sceneShotExists(
  session: DatabaseSession,
  sceneId: string,
  shotId: string
): boolean {
  const activeShotList = readActiveSceneShotListRecord(session, sceneId);
  const screenplay = readScreenplayDocumentFromSession(session);
  if (!activeShotList || !screenplay) {
    return false;
  }
  const document = readSceneShotListDocument({
    row: activeShotList,
    screenplay,
  });
  return document.shots.some((shot) => shot.shotId === shotId);
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

function unsupportedSelection(
  diagnostic: ReturnType<typeof createDiagnosticError>
): StudioSelectionContextResult {
  return {
    valid: false,
    reason: 'unsupportedSelection',
    diagnostics: buildDiagnosticResult([diagnostic]).issues,
  };
}
