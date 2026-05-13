import { resolveRenkuStorageRoot, type RenkuConfigPathOptions } from '../renku-config.js';
import { createProjectDataService } from '../project-data-service.js';
import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import { studioCoordinationWarning } from './errors.js';
import { isStudioRuntimeDescriptorStale, readStudioRuntimeDescriptor } from './runtime-descriptor.js';
import { resolveStudioSelectionForProject } from './focus-validation.js';
import type {
  StudioSelection,
  StudioBrowserSessionActiveEvent,
  StudioCurrent,
  StudioEvent,
  StudioFocusChangedEvent,
  StudioFocusRequestedEvent,
  StudioProjectRef,
} from './events.js';

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
  let latestFocusRequest: StudioFocusRequestedEvent | null = null;

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
    if (event.type === 'studio.focusRequested') {
      latestFocusRequest = event;
    }
  }

  const latestFocusRequestIsResolved = latestFocusRequest
    ? appliedRequests.has(latestFocusRequest.id) ||
      failedRequests.has(latestFocusRequest.id)
    : false;
  const latestFocusRequestIsFresh = latestFocusRequest
    ? now.getTime() - Date.parse(latestFocusRequest.createdAt) <=
      FOCUS_REQUEST_STALE_AFTER_MS
    : false;
  const latestPendingRequest =
    latestFocusRequest &&
    !latestFocusRequestIsResolved &&
    latestFocusRequestIsFresh
      ? latestFocusRequest
      : null;
  const latestStaleRequest =
    latestFocusRequest &&
    !latestFocusRequestIsResolved &&
    !latestFocusRequestIsFresh
      ? latestFocusRequest
      : null;

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
  selection: StudioSelection,
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

  const resolution = resolveStudioSelectionForProject(project, selection);
  return {
    project: {
      name: project.identity.name,
      id: project.identity.id,
      title: project.identity.title,
    },
    context: resolution.ok ? resolution.context : null,
    warnings: resolution.ok ? warnings : [...warnings, ...resolution.diagnostics],
  };
}
