import { resolveRenkuStorageRoot, type RenkuConfigPathOptions } from '../renku-config.js';
import { createProjectDataService } from '../project-data-service.js';
import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type {
  ScenePanelTab,
} from '../../client/index.js';
import { studioCoordinationWarning } from './errors.js';
import { isStudioRuntimeDescriptorUsable, readStudioRuntimeDescriptor } from './runtime-descriptor.js';
import { resolveStudioSelectionForProject } from './focus-validation.js';
import type {
  StudioSelection,
  StudioBrowserSessionActiveEvent,
  StudioCurrent,
  StudioCurrentContext,
  StudioEvent,
  StudioFocus,
  StudioFocusRequestedEvent,
  StudioProjectRef,
} from './events.js';

const BROWSER_SESSION_STALE_AFTER_MS = 120_000;
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
    runtime && isStudioRuntimeDescriptorUsable(runtime, now)
  );
  const sessionActivity = new Map<string, StudioBrowserSessionActiveEvent>();
  const sessionFocus = new Map<string, StudioSessionFocusCandidate>();
  const appliedRequests = new Set<string>();
  const failedRequests = new Set<string>();
  let latestFocusRequest: StudioFocusRequestedEvent | null = null;

  for (const event of input.events) {
    if (event.type === 'studio.browserSessionActive') {
      sessionActivity.set(event.browserSessionId, event);
      if (event.focus) {
        sessionFocus.set(event.browserSessionId, {
          browserSessionId: event.browserSessionId,
          createdAt: event.createdAt,
          focus: event.focus,
          projectRef: event.projectRef,
          activityKind: event.activityKind,
        });
      }
    }
    if (event.type === 'studio.focusChanged') {
      const browserSessionId = event.source.kind === 'studio'
        ? event.source.browserSessionId
        : undefined;
      if (browserSessionId) {
        sessionFocus.set(browserSessionId, {
          browserSessionId,
          createdAt: event.createdAt,
          focus: event.focus,
          projectRef: event.projectRef,
          activityKind: 'focused',
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
  const currentFocus = findCurrentLiveSessionFocus({
    activity: sessionActivity,
    focus: sessionFocus,
    now,
  });
  if (
    !currentFocus ||
    currentFocus.focus.screen !== 'movieStudio' ||
    !currentFocus.projectRef
  ) {
    return base;
  }

  const enriched = await enrichMovieStudioFocus(
    currentFocus.projectRef,
    currentFocus.focus.selection,
    input
  );
  return {
    ...base,
    project: enriched.project,
    selection: currentFocus.focus.selection,
    context: enriched.context,
    warnings: [...base.warnings, ...enriched.warnings],
  };
}

interface StudioSessionFocusCandidate {
  browserSessionId: string;
  createdAt: string;
  focus: StudioFocus;
  projectRef?: StudioProjectRef;
  activityKind?: StudioBrowserSessionActiveEvent['activityKind'];
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

function findCurrentLiveSessionFocus(input: {
  activity: Map<string, StudioBrowserSessionActiveEvent>;
  focus: Map<string, StudioSessionFocusCandidate>;
  now: Date;
}): StudioSessionFocusCandidate | null {
  let result: StudioSessionFocusCandidate | null = null;
  for (const candidate of input.focus.values()) {
    const activity = input.activity.get(candidate.browserSessionId);
    if (
      !activity ||
      input.now.getTime() - Date.parse(activity.createdAt) >
        BROWSER_SESSION_STALE_AFTER_MS
    ) {
      continue;
    }
    if (
      !result ||
      compareSessionFocusCandidates({
        left: candidate,
        right: result,
        activity: input.activity,
      }) >= 0
    ) {
      result = candidate;
    }
  }
  return result;
}

function compareSessionFocusCandidates(input: {
  left: StudioSessionFocusCandidate;
  right: StudioSessionFocusCandidate;
  activity: Map<string, StudioBrowserSessionActiveEvent>;
}): number {
  const leftActivity = input.activity.get(input.left.browserSessionId);
  const rightActivity = input.activity.get(input.right.browserSessionId);
  const activityRankDiff =
    activityKindRank(leftActivity?.activityKind ?? input.left.activityKind) -
    activityKindRank(rightActivity?.activityKind ?? input.right.activityKind);
  if (activityRankDiff !== 0) {
    return activityRankDiff;
  }
  const focusTimeDiff =
    Date.parse(input.left.createdAt) - Date.parse(input.right.createdAt);
  if (focusTimeDiff !== 0) {
    return focusTimeDiff;
  }
  return (
    Date.parse(leftActivity?.createdAt ?? input.left.createdAt) -
    Date.parse(rightActivity?.createdAt ?? input.right.createdAt)
  );
}

function activityKindRank(
  activityKind: StudioBrowserSessionActiveEvent['activityKind']
): number {
  if (activityKind === 'focused') {
    return 3;
  }
  if (activityKind === 'visible') {
    return 2;
  }
  if (activityKind === 'heartbeat') {
    return 1;
  }
  return 0;
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
  const projectData = createProjectDataService();
  const project = await projectData.readProject({
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
  let context: StudioCurrentContext | null = resolution.ok ? resolution.context : null;
  if (resolution.ok && context?.kind === 'scene') {
    const enriched = await enrichSceneBeatFocusContext({
      projectData,
      projectName: project.identity.name,
      selection,
      context,
      options,
    });
    context = enriched.context;
    warnings.push(...enriched.warnings);
  }
  return {
    project: {
      name: project.identity.name,
      id: project.identity.id,
      title: project.identity.title,
    },
    context,
    warnings: resolution.ok ? warnings : [...warnings, ...resolution.diagnostics],
  };
}

function enrichSceneBeatFocusContext(input: {
  projectData: ReturnType<typeof createProjectDataService>;
  projectName: string;
  selection: StudioSelection;
  context: Extract<StudioCurrentContext, { kind: 'scene' }>;
  options: RenkuConfigPathOptions;
}): Promise<{
  context: Extract<StudioCurrentContext, { kind: 'scene' }>;
  warnings: DiagnosticIssue[];
}> {
  if (input.selection.type !== 'scene') {
    return Promise.resolve({ context: input.context, warnings: [] });
  }
  return Promise.resolve({
    context: {
      ...input.context,
      sceneTab: sceneTabLabel(input.selection.sceneTab ?? 'narrative'),
    },
    warnings: [],
  });
}

function sceneTabLabel(tab: ScenePanelTab) {
  return {
    id: tab,
    label: tab === 'beats' ? 'Beats' : tab === 'shots' ? 'Shots' : 'Narrative',
  };
}
