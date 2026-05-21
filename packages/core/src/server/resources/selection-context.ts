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
  readCastNavigationRow,
  readSceneNavigationContext,
  readSequenceNavigationContext,
} from '../database/access/navigation.js';

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
      case 'visualLanguage':
        return {
          valid: true,
          selection: input.selection,
          context: { surface: 'visual-language' },
          resourceKeys: ['navigation:visual-language'],
        };
      case 'storyboard':
        return {
          valid: true,
          selection: input.selection,
          context: { surface: 'storyboard' },
          resourceKeys: ['project-shell'],
        };
      case 'casting':
        return {
          valid: true,
          selection: input.selection,
          context: {
            surface: 'casting',
            cast: listCastNavigationPage(session, {}),
          },
          resourceKeys: ['navigation:cast'],
        };
      case 'cast': {
        const castMember = readCastNavigationRow(session, input.selection.id);
        return castMember
          ? {
              valid: true,
              selection: input.selection,
              context: {
                surface: 'cast-design',
                castMember,
              },
              resourceKeys: [`surface:cast-design:${castMember.id}`],
            }
          : selectionNotFound(input.selection);
      }
      case 'sequence': {
        const chain = readSequenceNavigationContext(session, input.selection.id);
        return chain
          ? {
              valid: true,
              selection: input.selection,
              context: {
                surface: 'sequence',
                sequence: chain.sequence,
              },
              resourceKeys: ['navigation:movie-sequences'],
            }
          : selectionNotFound(input.selection);
      }
      case 'scene': {
        const chain = readSceneNavigationContext(session, input.selection.id);
        return chain
          ? {
              valid: true,
              selection: input.selection,
              context: {
                surface: 'scene',
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
