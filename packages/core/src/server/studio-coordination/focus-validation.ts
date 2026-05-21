import {
  createDiagnosticError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type {
  CastMember,
  Project,
  Scene,
  Sequence,
} from '../../client/index.js';
import type {
  StudioSelection,
  StudioCurrentContext,
  StudioFocusRequest,
} from './events.js';

export type StudioSelectionResolution =
  | {
      ok: true;
      selection: StudioSelection;
      context: StudioCurrentContext;
    }
  | {
      ok: false;
      selection: StudioSelection;
      reason: 'selectionNotFound' | 'unsupportedSelection';
      diagnostics: DiagnosticIssue[];
    };

export type StudioFocusRequestValidation =
  | {
      ok: true;
      focus: StudioFocusRequest;
      context: StudioCurrentContext | null;
    }
  | {
      ok: false;
      focus: StudioFocusRequest;
      reason: 'selectionNotFound' | 'unsupportedSelection';
      diagnostics: DiagnosticIssue[];
    };

export function validateStudioFocusRequestForProject(
  project: Project,
  focus: StudioFocusRequest
): StudioFocusRequestValidation {
  if (focus.screen === 'projectLibrary') {
    return { ok: true, focus, context: null };
  }

  const selection = resolveStudioSelectionForProject(
    project,
    focus.selection
  );
  if (!selection.ok) {
    return {
      ok: false,
      focus,
      reason: selection.reason,
      diagnostics: selection.diagnostics,
    };
  }

  return {
    ok: true,
    focus,
    context: selection.context,
  };
}

export function resolveStudioSelectionForProject(
  project: Project,
  selection: StudioSelection
): StudioSelectionResolution {
  if (selection.type === 'projectInformation') {
    return {
      ok: true,
      selection,
      context: {
        kind: 'projectInformation',
        title: project.identity.title,
        aspectRatio: project.identity.aspectRatio,
        logline: project.identity.logline,
        summary: project.identity.summary,
        languages: project.languages,
      },
    };
  }

  if (selection.type === 'visualLanguage') {
    return {
      ok: true,
      selection,
      context: { kind: 'visualLanguage', entries: project.visualLanguage },
    };
  }

  if (selection.type === 'storyboard') {
    return {
      ok: true,
      selection,
      context: {
        kind: 'storyboard',
        projectTitle: project.identity.title,
        sequences: project.sequences.map((sequence) => ({
          id: sequence.id,
          number: sequence.number,
          title: sequence.title,
          scenes: sequence.scenes.map((scene) => ({
            id: scene.id,
            title: scene.title,
          })),
        })),
      },
    };
  }

  if (selection.type === 'casting') {
    return {
      ok: true,
      selection,
      context: { kind: 'casting', cast: project.cast },
    };
  }

  if (selection.type === 'cast') {
    const castMember = findCastMember(project, selection.id);
    if (!castMember) {
      return missingSelection(
        selection,
        'STUDIO_COORDINATION033',
        `Requested cast member '${selection.id}' was not found.`,
        ['focus', 'selection', 'id'],
        'Select an existing cast member before requesting Studio focus.'
      );
    }
    return {
      ok: true,
      selection,
      context: {
        kind: 'castMember',
        id: castMember.id,
        name: castMember.name,
        castKind: castMember.kind,
        role: castMember.role,
        shortDescription: castMember.shortDescription,
      },
    };
  }

  if (selection.type === 'sequence') {
    const sequence = findSequence(project, selection.id);
    if (!sequence) {
      return missingSelection(
        selection,
        'STUDIO_COORDINATION030',
        `Requested sequence '${selection.id}' was not found.`,
        ['focus', 'selection', 'id'],
        'Select an existing sequence before requesting Studio focus.'
      );
    }
    return {
      ok: true,
      selection,
      context: {
        kind: 'sequence',
        id: sequence.id,
        number: sequence.number,
        title: sequence.title,
        shortTitle: sequence.shortTitle,
        summary: sequence.summary,
        scenes: sequence.scenes.map((scene) => ({
          id: scene.id,
          title: scene.title,
          summary: scene.summary,
        })),
      },
    };
  }

  if (selection.type === 'scene') {
    const resolved = findScene(project, selection.id);
    if (!resolved) {
      return missingSelection(
        selection,
        'STUDIO_COORDINATION031',
        `Requested scene '${selection.id}' was not found.`,
        ['focus', 'selection', 'id'],
        'Select an existing scene before requesting Studio focus.'
      );
    }
    return {
      ok: true,
      selection,
      context: {
        kind: 'scene',
        id: resolved.scene.id,
        title: resolved.scene.title,
        summary: resolved.scene.summary,
        parentSequence: {
          id: resolved.sequence.id,
          number: resolved.sequence.number,
          title: resolved.sequence.title,
          summary: resolved.sequence.summary,
        },
      },
    };
  }

  return {
    ok: false,
    selection,
    reason: 'unsupportedSelection',
    diagnostics: [
      createDiagnosticError(
        'STUDIO_COORDINATION034',
        'Requested Studio focus selection is not supported.',
        { path: ['focus', 'selection'], context: 'studio.focusRequested' },
        'Request a supported Movie Studio selection.'
      ),
    ],
  };
}

function findSequence(project: Project, id: string): Sequence | null {
  return project.sequences.find((sequence) => sequence.id === id) ?? null;
}

function findScene(
  project: Project,
  id: string
): { sequence: Sequence; scene: Scene } | null {
  for (const sequence of project.sequences) {
    const scene = sequence.scenes.find((entry) => entry.id === id);
    if (scene) {
      return { sequence, scene };
    }
  }
  return null;
}

function findCastMember(project: Project, id: string): CastMember | null {
  return project.cast.find((entry) => entry.id === id) ?? null;
}

function missingSelection(
  selection: StudioSelection,
  code: string,
  message: string,
  path: string[],
  suggestion: string
): StudioSelectionResolution {
  return {
    ok: false,
    selection,
    reason: 'selectionNotFound',
    diagnostics: [
      createDiagnosticError(
        code,
        message,
        { path, context: 'studio.focusRequested' },
        suggestion
      ),
    ],
  };
}
