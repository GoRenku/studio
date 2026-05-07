import { resolveRenkuStorageRoot, type RenkuConfigPathOptions } from '../config.js';
import { createProjectDataService } from '../project/index.js';
import type { Project } from '../../project/index.js';
import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import { studioCoordinationWarning } from './studio-coordination-errors.js';
import { isStudioRuntimeDescriptorStale, readStudioRuntimeDescriptor } from './studio-runtime-descriptor.js';
import type {
  MovieStudioSelection,
  StudioBrowserSessionActiveEvent,
  StudioCurrent,
  StudioCurrentContext,
  StudioEvent,
  StudioFocusChangedEvent,
  StudioFocusRequestedEvent,
  StudioProjectRef,
} from './studio-coordination-events.js';

const BROWSER_SESSION_STALE_AFTER_MS = 45_000;
const FOCUS_REQUEST_STALE_AFTER_MS = 5 * 60_000;

export interface ProjectStudioCurrentInput extends RenkuConfigPathOptions {
  events: StudioEvent[];
  warnings: StudioCurrent['warnings'];
  now?: Date;
}

export async function projectStudioCurrent(
  input: ProjectStudioCurrentInput
): Promise<StudioCurrent> {
  const now = input.now ?? new Date();
  const runtime = await readStudioRuntimeDescriptor(input);
  const runtimeActive = Boolean(
    runtime && !isStudioRuntimeDescriptorStale(runtime, now)
  );
  const sessionActivity = new Map<string, StudioBrowserSessionActiveEvent>();
  const sessionFocus = new Map<string, StudioFocusChangedEvent>();
  const appliedRequests = new Set<string>();
  const failedRequests = new Set<string>();
  let latestPendingRequest: StudioFocusRequestedEvent | null = null;
  let latestStaleRequest: StudioFocusRequestedEvent | null = null;

  for (const event of input.events) {
    if (event.type === 'studio.browserSessionActive') {
      sessionActivity.set(event.browserSessionId, event);
    }
    if (event.type === 'studio.focusChanged') {
      const browserSessionId = event.source.kind === 'studio'
        ? event.source.browserSessionId
        : undefined;
      if (browserSessionId) {
        sessionFocus.set(browserSessionId, event);
        sessionActivity.set(browserSessionId, {
          ...event,
          type: 'studio.browserSessionActive',
          browserSessionId,
        });
      }
      if (event.appliedRequestId) {
        appliedRequests.add(event.appliedRequestId);
      }
    }
    if (event.type === 'studio.focusRequestFailed') {
      failedRequests.add(event.requestEventId);
    }
  }

  for (const event of input.events) {
    if (
      event.type === 'studio.focusRequested' &&
      !appliedRequests.has(event.id) &&
      !failedRequests.has(event.id)
    ) {
      if (now.getTime() - Date.parse(event.createdAt) <= FOCUS_REQUEST_STALE_AFTER_MS) {
        latestPendingRequest = event;
      } else {
        latestStaleRequest = event;
      }
    }
  }

  const warnings = [...input.warnings];
  if (!latestPendingRequest && latestStaleRequest) {
    warnings.push(
      studioCoordinationWarning(
        'STUDIO_COORDINATION020',
        'A previous Studio focus request was ignored because it is stale.',
        ['pendingRequest'],
        'Ask the user which project or selection they want to target.'
      )
    );
  }

  const currentSessionId = findMostRecentLiveSessionId(sessionActivity, now);
  const running = runtimeActive || currentSessionId !== null;

  const base: StudioCurrent = {
    studio: { running },
    project: null,
    selection: null,
    context: null,
    pendingRequest: latestPendingRequest
      ? {
          eventId: latestPendingRequest.id,
          projectRef: latestPendingRequest.projectRef,
          focus: latestPendingRequest.focus,
          refresh: latestPendingRequest.refresh,
          createdAt: latestPendingRequest.createdAt,
        }
      : null,
    warnings,
  };

  if (!running) {
    return base;
  }

  if (!currentSessionId) {
    return base;
  }
  const focusEvent = sessionFocus.get(currentSessionId);
  if (!focusEvent || focusEvent.focus.screen !== 'movieStudio' || !focusEvent.projectRef) {
    return base;
  }

  const enriched = await enrichMovieStudioFocus(focusEvent.projectRef, focusEvent.focus.selection, input);
  return {
    ...base,
    project: enriched.project,
    selection: focusEvent.focus.selection,
    context: enriched.context,
    warnings: [...base.warnings, ...enriched.warnings],
  };
}

function findMostRecentLiveSessionId(
  activity: Map<string, StudioBrowserSessionActiveEvent>,
  now: Date
): string | null {
  let result: StudioBrowserSessionActiveEvent | null = null;
  for (const event of activity.values()) {
    if (now.getTime() - Date.parse(event.createdAt) > BROWSER_SESSION_STALE_AFTER_MS) {
      continue;
    }
    if (!result || Date.parse(event.createdAt) >= Date.parse(result.createdAt)) {
      result = event;
    }
  }
  return result?.browserSessionId ?? null;
}

async function enrichMovieStudioFocus(
  projectRef: StudioProjectRef,
  selection: MovieStudioSelection,
  options: RenkuConfigPathOptions
) {
  const warnings: DiagnosticIssue[] = [];
  const storageRoot = await resolveRenkuStorageRoot(options);
  if (storageRoot !== projectRef.storageRoot) {
    warnings.push(
      studioCoordinationWarning(
        'STUDIO_COORDINATION011',
        'Current project reference no longer matches the configured storage root.',
        ['project'],
        'Select the project again before acting on this Studio context.'
      )
    );
    return { project: null, context: null, warnings };
  }
  const project = await createProjectDataService().readProject({
    projectName: projectRef.name,
    homeDir: options.homeDir,
  });
  if (project.identity.id !== projectRef.id) {
    warnings.push(
      studioCoordinationWarning(
        'STUDIO_COORDINATION012',
        'Current project reference no longer matches the project database.',
        ['project'],
        'Select the project again before acting on this Studio context.'
      )
    );
    return { project: null, context: null, warnings };
  }

  return {
    project: {
      name: project.identity.name,
      id: project.identity.id,
      title: project.identity.title,
    },
    context: buildContext(project, selection),
    warnings,
  };
}

function buildContext(project: Project, selection: MovieStudioSelection): StudioCurrentContext | null {
  if (selection.type === 'projectInformation') {
    return {
      kind: 'projectInformation',
      title: project.identity.title,
      aspectRatio: project.identity.aspectRatio,
      logline: project.identity.logline,
      summary: project.identity.summary,
      languages: project.languages,
    };
  }
  if (selection.type === 'visualLanguage') {
    return { kind: 'visualLanguage', entries: project.visualLanguage };
  }
  if (selection.type === 'casting') {
    return { kind: 'casting', cast: project.cast };
  }
  if (selection.type === 'storyboard') {
    return {
      kind: 'storyboard',
      projectTitle: project.identity.title,
      sequences: project.sequences.map((sequence) => ({
        id: sequence.id,
        number: sequence.number,
        title: sequence.title,
        scenes: sequence.scenes.map((scene) => ({
          id: scene.id,
          title: scene.title,
          clips: scene.clips.map((clip) => ({ id: clip.id, title: clip.title })),
        })),
      })),
    };
  }
  if (selection.type === 'cast') {
    const cast = project.cast.find((entry) => entry.id === selection.id);
    return cast
      ? {
          kind: 'castMember',
          id: cast.id,
          name: cast.name,
          castKind: cast.kind,
          role: cast.role,
          shortDescription: cast.shortDescription,
        }
      : null;
  }
  for (const sequence of project.sequences) {
    if (selection.type === 'sequence' && sequence.id === selection.id) {
      return {
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
      };
    }
    for (const scene of sequence.scenes) {
      if (selection.type === 'scene' && scene.id === selection.id) {
        return {
          kind: 'scene',
          id: scene.id,
          title: scene.title,
          summary: scene.summary,
          parentSequence: {
            id: sequence.id,
            number: sequence.number,
            title: sequence.title,
            summary: sequence.summary,
          },
          clips: scene.clips.map((clip) => ({
            id: clip.id,
            title: clip.title,
            summary: clip.summary,
          })),
        };
      }
      for (const clip of scene.clips) {
        if (selection.type === 'clip' && clip.id === selection.id) {
          return {
            kind: 'clip',
            id: clip.id,
            title: clip.title,
            summary: clip.summary,
            visualIntent: clip.visualIntent,
            parentScene: {
              id: scene.id,
              title: scene.title,
              summary: scene.summary,
            },
            parentSequence: {
              id: sequence.id,
              number: sequence.number,
              title: sequence.title,
              summary: sequence.summary,
            },
          };
        }
      }
    }
  }
  return null;
}
