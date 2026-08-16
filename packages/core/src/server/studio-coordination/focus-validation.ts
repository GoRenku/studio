import { createDiagnosticError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type {
  ProjectShell,
  ScenePanelTab,
  StudioSelection,
} from '../../client/index.js';
import type { StudioCurrentContext, StudioFocusRequest } from './events.js';
import { parseStudioSelection } from './selection-validation.js';

export type StudioSelectionResolution =
  | { ok: true; selection: StudioSelection; context: StudioCurrentContext }
  | {
      ok: false;
      selection: StudioSelection;
      reason: 'selectionNotFound' | 'unsupportedSelection';
      diagnostics: DiagnosticIssue[];
    };

export type StudioFocusRequestValidation =
  | { ok: true; focus: StudioFocusRequest; context: StudioCurrentContext | null }
  | {
      ok: false;
      focus: StudioFocusRequest;
      reason: 'selectionNotFound' | 'unsupportedSelection';
      diagnostics: DiagnosticIssue[];
    };

export function validateStudioFocusRequestForProject(
  shell: ProjectShell,
  focus: StudioFocusRequest,
): StudioFocusRequestValidation {
  if (focus.screen === 'projectLibrary') {
    return { ok: true, focus, context: null };
  }
  const selection = resolveStudioSelectionForProject(shell, focus.selection);
  return selection.ok
    ? { ok: true, focus, context: selection.context }
    : { ok: false, focus, reason: selection.reason, diagnostics: selection.diagnostics };
}

export function resolveStudioSelectionForProject(
  shell: ProjectShell,
  selection: StudioSelection,
): StudioSelectionResolution {
  const parsed = parseStudioSelection(selection, {
    path: ['focus', 'selection'],
    context: 'studio.focusRequested',
  });
  if (!parsed.valid) {
    return {
      ok: false,
      selection,
      reason: 'unsupportedSelection',
      diagnostics: parsed.issues,
    };
  }
  selection = parsed.selection;
  const project = shell.project;
  const screenplay = shell.navigation.screenplay.screenplay;

  if (selection.type === 'projectInformation') {
    return success(selection, {
      kind: 'projectInformation',
      title: project.title,
      aspectRatio: project.aspectRatio,
      logline: project.logline,
      summary: project.synopsis,
      languages: shell.languages,
    });
  }
  if (selection.type === 'screenplay') {
    return success(selection, {
      kind: 'screenplay',
      projectTitle: project.title,
      scenes: screenplay.scenes.map((scene) => ({
        id: scene.id,
        heading: scene.heading,
        title: scene.title,
      })),
    });
  }
  if (selection.type === 'inspiration' || selection.type === 'lookbook') {
    return success(selection, {
      kind: 'visualLanguage',
      sections: ['inspiration', 'lookbooks'],
    });
  }
  if (selection.type === 'storyArc') {
    return success(selection, {
      kind: 'storyArc',
      projectTitle: project.title,
      sections: screenplay.sections.map((section) => ({
        id: section.id,
        type: section.type,
        title: section.title,
      })),
    });
  }
  if (selection.type === 'cast') {
    return success(selection, {
      kind: 'cast',
      cast: shell.navigation.cast.items.map((entry) => ({
        id: entry.id,
        name: entry.name,
        role: entry.role,
      })),
    });
  }
  if (selection.type === 'castMember') {
    const entry = shell.navigation.cast.items.find((value) => value.id === selection.id);
    return entry
      ? success(selection, { kind: 'castMember', id: entry.id, name: entry.name, role: entry.role })
      : missing(selection, `Requested Cast Member '${selection.id}' was not found.`);
  }
  if (selection.type === 'locations') {
    return success(selection, {
      kind: 'locations',
      locations: shell.navigation.locations.items.map((entry) => ({
        id: entry.id,
        name: entry.name,
        timePeriod: entry.timePeriod,
      })),
    });
  }
  if (selection.type === 'location') {
    const entry = shell.navigation.locations.items.find((value) => value.id === selection.id);
    return entry
      ? success(selection, { kind: 'location', id: entry.id, name: entry.name, timePeriod: entry.timePeriod })
      : missing(selection, `Requested Location '${selection.id}' was not found.`);
  }
  if (selection.type === 'props') {
    return success(selection, {
      kind: 'props',
      props: shell.navigation.props.items.map((entry) => ({ id: entry.id, name: entry.name })),
    });
  }
  if (selection.type === 'prop') {
    const entry = shell.navigation.props.items.find((value) => value.id === selection.id);
    return entry
      ? success(selection, { kind: 'prop', id: entry.id, name: entry.name })
      : missing(selection, `Requested Prop '${selection.id}' was not found.`);
  }
  if (selection.type === 'scene') {
    const scene = screenplay.scenes.find((value) => value.id === selection.id);
    if (!scene) {
      return missing(selection, `Requested Scene '${selection.id}' was not found.`);
    }
    return success(selection, {
      kind: 'scene',
      id: scene.id,
      title: scene.title ?? scene.heading,
      productionNumber: scene.productionNumber,
      parentSections: parentSections(screenplay, scene.id),
      sceneTab: sceneTabLabel(selection.sceneTab ?? (selection.beatId ? 'beats' : 'narrative')),
    });
  }
  return {
    ok: false,
    selection,
    reason: 'unsupportedSelection',
    diagnostics: [createDiagnosticError(
      'STUDIO_COORDINATION034',
      'Requested Studio focus selection is not supported.',
      { path: ['focus', 'selection'], context: 'studio.focusRequested' },
      'Request a supported Movie Studio selection.',
    )],
  };
}

function parentSections(
  screenplay: ProjectShell['navigation']['screenplay']['screenplay'],
  sceneId: string,
): Array<{ id: string; type: 'act' | 'sequence'; title: string }> {
  const result: Array<{ id: string; type: 'act' | 'sequence'; title: string }> = [];
  let entry = screenplay.structure.find(
    (value) => value.content.type === 'scene' && value.content.sceneId === sceneId,
  );
  while (entry?.parentSectionId) {
    const section = screenplay.sections.find((value) => value.id === entry!.parentSectionId);
    if (!section) {
      break;
    }
    result.unshift({ id: section.id, type: section.type, title: section.title });
    entry = screenplay.structure.find(
      (value) => value.content.type === 'section' && value.content.sectionId === section.id,
    );
  }
  return result;
}

function success(
  selection: StudioSelection,
  context: StudioCurrentContext,
): StudioSelectionResolution {
  return { ok: true, selection, context };
}

function missing(selection: StudioSelection, message: string): StudioSelectionResolution {
  return {
    ok: false,
    selection,
    reason: 'selectionNotFound',
    diagnostics: [createDiagnosticError(
      'STUDIO_COORDINATION031',
      message,
      { path: ['focus', 'selection', 'id'], context: 'studio.focusRequested' },
      'Select an existing Screenplay or Project entity.',
    )],
  };
}

function sceneTabLabel(tab: ScenePanelTab): { id: ScenePanelTab; label: string } {
  return {
    id: tab,
    label: tab === 'beats'
      ? 'Beats'
      : tab === 'shotPlans'
        ? 'Shot Plans'
        : tab === 'generations'
          ? 'Generations'
          : 'Narrative',
  };
}
