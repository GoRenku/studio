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
        const chain = readSceneNavigationContext(session, input.selection.id);
        const act = chain ? readActNavigationRow(session, chain.sequence.actId) : null;
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
