import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectSession } from '@/app/use-project-session';
import type { MovieStudioSelection } from '@/features/movie-studio/movie-studio-selection';
import type { ProjectWithHttp } from '@/services/studio-project-contracts';
import {
  readStudioEvents,
  readStudioCurrent,
  reportBrowserSessionActive,
  reportStudioFocusChanged,
  reportStudioFocusRequestFailed,
  validateStudioFocusRequest,
} from '@/services/studio-events-api';
import type {
  StudioFocus,
  StudioEvent,
  StudioFocusRequestedEvent,
  StudioPendingRequest,
  StudioProjectRef,
} from '@/services/studio-current-contracts';

const BROWSER_SESSION_KEY = 'renku.studio.browserSessionId';
const POLLING_INTERVAL_MS = 2_000;
const ACTIVITY_DEBOUNCE_MS = 30_000;
const VISIBLE_HEARTBEAT_MS = 60_000;

export interface StudioCoordinationSelection {
  selection: MovieStudioSelection;
  setSelection: (selection: MovieStudioSelection) => void;
}

export function useStudioCoordination(input: {
  projectSession: ProjectSession;
  movieStudioSelection: StudioCoordinationSelection | null;
}) {
  const { projectSession, movieStudioSelection } = input;
  const [browserSessionId] = useState(readBrowserSessionId);
  const cursorRef = useRef<string | undefined>(undefined);
  const hasInitializedEventCursorRef = useRef(false);
  const [isEventCursorReady, setIsEventCursorReady] = useState(false);
  const hasCheckedStartupPendingRequestRef = useRef(false);
  const pollInFlightRef = useRef(false);
  const pollAgainRef = useRef(false);
  const lastActivityRef = useRef(0);
  const focusRequestInProgressRef = useRef<string | null>(null);
  const appliedRequestIdRef = useRef<string | null>(null);
  const appliedFocusRequestIdsRef = useRef<Set<string>>(new Set());
  const lastReportedFocusKeyRef = useRef<string | null>(null);
  const projectSessionRef = useRef(projectSession);
  const currentProjectRef = useRef<ProjectWithHttp | null>(projectSession.project);
  const setSelectionRef = useRef<
    ((selection: MovieStudioSelection) => void) | null
  >(movieStudioSelection?.setSelection ?? null);
  const selection = movieStudioSelection?.selection ?? null;

  useEffect(() => {
    projectSessionRef.current = projectSession;
    currentProjectRef.current = projectSession.project;
  }, [projectSession]);

  useEffect(() => {
    setSelectionRef.current = movieStudioSelection?.setSelection ?? null;
  }, [movieStudioSelection?.setSelection]);

  const reportActivity = useCallback(async () => {
    const now = Date.now();
    if (now - lastActivityRef.current < ACTIVITY_DEBOUNCE_MS) {
      return;
    }
    lastActivityRef.current = now;
    try {
      await reportBrowserSessionActive(browserSessionId);
    } catch {
      // Browser activity is best-effort local coordination.
    }
  }, [browserSessionId]);

  const processEventBatch = useCallback(async () => {
    const response = await readStudioEvents(cursorRef.current);
    cursorRef.current = response.nextCursor;
    if (!hasInitializedEventCursorRef.current) {
      hasInitializedEventCursorRef.current = true;
      setIsEventCursorReady(true);
      return;
    }
    await applyStudioEventBatch({
      events: response.events,
      browserSessionId,
      projectSessionRef,
      setSelectionRef,
      currentProjectRef,
      focusRequestInProgressRef,
      appliedRequestIdRef,
      appliedFocusRequestIdsRef,
    });
  }, [browserSessionId]);

  const requestPoll = useCallback(() => {
    if (pollInFlightRef.current) {
      pollAgainRef.current = true;
      return;
    }

    pollInFlightRef.current = true;
    void (async () => {
      try {
        do {
          pollAgainRef.current = false;
          await processEventBatch();
        } while (pollAgainRef.current);
      } catch {
        // Polling retries on the next tick. The API also exposes warnings for malformed history.
      } finally {
        pollInFlightRef.current = false;
      }
    })();
  }, [processEventBatch]);

  useEffect(() => {
    void reportActivity();
    requestPoll();
    const interval = window.setInterval(() => {
      requestPoll();
    }, POLLING_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [requestPoll, reportActivity]);

  useEffect(() => {
    const reportVisibleActivity = () => {
      if (document.visibilityState === 'visible') {
        void reportActivity();
        requestPoll();
      }
    };
    window.addEventListener('focus', reportVisibleActivity);
    document.addEventListener('visibilitychange', reportVisibleActivity);
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void reportActivity();
      }
    }, VISIBLE_HEARTBEAT_MS);
    return () => {
      window.removeEventListener('focus', reportVisibleActivity);
      document.removeEventListener('visibilitychange', reportVisibleActivity);
      window.clearInterval(heartbeat);
    };
  }, [requestPoll, reportActivity]);

  useEffect(() => {
    if (
      !isEventCursorReady ||
      projectSession.isLoadingProjectRoute ||
      hasCheckedStartupPendingRequestRef.current
    ) {
      return;
    }

    hasCheckedStartupPendingRequestRef.current = true;
    void applyStartupPendingFocusRequest({
      browserSessionId,
      projectSessionRef,
      setSelectionRef,
      currentProjectRef,
      focusRequestInProgressRef,
      appliedRequestIdRef,
      appliedFocusRequestIdsRef,
    }).catch(() => {
      // Startup coordination retries through the regular polling path.
    });
  }, [browserSessionId, isEventCursorReady, projectSession.isLoadingProjectRoute]);

  useEffect(() => {
    if (
      projectSession.isLoadingProjectRoute ||
      focusRequestInProgressRef.current
    ) {
      return;
    }

    const project = projectSession.project;
    const observation = project && selection
      ? {
          focus: { screen: 'movieStudio', selection } as StudioFocus,
          focusKey: `movieStudio:${project.identity.id}:${JSON.stringify(selection)}`,
          projectRef: toProjectRef(project),
        }
      : {
          focus: { screen: 'projectLibrary' } as StudioFocus,
          focusKey: 'projectLibrary',
          projectRef: undefined,
        };

    const appliedRequestId = appliedRequestIdRef.current ?? undefined;
    if (!appliedRequestId && lastReportedFocusKeyRef.current === observation.focusKey) {
      return;
    }
    appliedRequestIdRef.current = null;
    lastReportedFocusKeyRef.current = observation.focusKey;

    void reportStudioFocusChanged({
      browserSessionId,
      projectRef: observation.projectRef,
      focus: observation.focus,
      appliedRequestId,
    }).catch(() => {
      // Local coordination reporting should not break the Studio UI render path.
    });
  }, [
    browserSessionId,
    projectSession.isLoadingProjectRoute,
    selection,
    projectSession.project,
  ]);
}

interface StudioCoordinationRefs {
  projectSessionRef: { current: ProjectSession };
  setSelectionRef: {
    current: ((selection: MovieStudioSelection) => void) | null;
  };
  currentProjectRef: { current: ProjectWithHttp | null };
  focusRequestInProgressRef: { current: string | null };
  appliedRequestIdRef: { current: string | null };
  appliedFocusRequestIdsRef: { current: Set<string> };
}

async function applyStudioEventBatch(input: {
  events: StudioEvent[];
  browserSessionId: string;
} & StudioCoordinationRefs): Promise<void> {
  const latestFocusRequest = latestFocusRequestIn(
    input.events,
    input.appliedFocusRequestIdsRef.current
  );
  const refreshedProjectIds = new Set<string>();

  for (const event of input.events) {
    if (event.type === 'studio.projectRefreshRequested') {
      const refreshEvent = event as {
        projectRef: StudioProjectRef;
      };
      if (
        input.currentProjectRef.current?.identity.id ===
        refreshEvent.projectRef.id
      ) {
        const project = await input.projectSessionRef.current.refreshProject(
          refreshEvent.projectRef.name
        );
        input.currentProjectRef.current = project;
        refreshedProjectIds.add(refreshEvent.projectRef.id);
      }
    }

    if (
      event.type === 'studio.focusRequested' &&
      event.id === latestFocusRequest?.id
    ) {
      await applyFocusRequest({
        event: event as StudioFocusRequestedEvent,
        browserSessionId: input.browserSessionId,
        projectSessionRef: input.projectSessionRef,
        setSelectionRef: input.setSelectionRef,
        currentProjectRef: input.currentProjectRef,
        focusRequestInProgressRef: input.focusRequestInProgressRef,
        appliedRequestIdRef: input.appliedRequestIdRef,
        appliedFocusRequestIdsRef: input.appliedFocusRequestIdsRef,
        refreshedProjectIds,
      });
    }
  }
}

function latestFocusRequestIn(
  events: StudioEvent[],
  appliedFocusRequestIds: Set<string>
): StudioFocusRequestedEvent | null {
  let latestFocusRequest: StudioFocusRequestedEvent | null = null;
  for (const event of events) {
    if (
      event.type === 'studio.focusRequested' &&
      !appliedFocusRequestIds.has(event.id)
    ) {
      latestFocusRequest = event as StudioFocusRequestedEvent;
    }
  }
  return latestFocusRequest;
}

async function applyFocusRequest(input: {
  event: StudioFocusRequestedEvent;
  browserSessionId: string;
  refreshedProjectIds?: Set<string>;
} & StudioCoordinationRefs): Promise<void> {
  input.focusRequestInProgressRef.current = input.event.id;
  try {
    if (input.event.focus.screen === 'projectLibrary') {
      input.appliedRequestIdRef.current = input.event.id;
      input.appliedFocusRequestIdsRef.current.add(input.event.id);
      input.currentProjectRef.current = null;
      input.projectSessionRef.current.returnToProjectLibrary();
      return;
    }

    let project = input.currentProjectRef.current;
    if (!input.event.projectRef) {
      await reportStudioFocusRequestFailed({
        browserSessionId: input.browserSessionId,
        requestEventId: input.event.id,
        reason: 'projectRefMismatch',
        diagnostics: [],
      });
      return;
    }

    if (project?.identity.id !== input.event.projectRef.id) {
      project = await input.projectSessionRef.current.navigateToProject(
        input.event.projectRef.name
      );
      input.currentProjectRef.current = project;
      if (!project) {
        await reportStudioFocusRequestFailed({
          browserSessionId: input.browserSessionId,
          requestEventId: input.event.id,
          reason: 'projectNotFound',
          diagnostics: [],
        });
        return;
      }
    }

    if (
      input.event.refresh?.project &&
      !input.refreshedProjectIds?.has(input.event.projectRef.id)
    ) {
      project = await input.projectSessionRef.current.refreshProject(
        input.event.projectRef.name
      );
      input.currentProjectRef.current = project;
    }
    if (project.identity.id !== input.event.projectRef.id) {
      await reportStudioFocusRequestFailed({
        browserSessionId: input.browserSessionId,
        requestEventId: input.event.id,
        reason: 'projectRefMismatch',
        diagnostics: [],
      });
      return;
    }
    if (input.event.refresh?.library) {
      await input.projectSessionRef.current.refreshProjectLibrary();
    }
    const setSelection = input.setSelectionRef.current;
    if (!setSelection) {
      await reportStudioFocusRequestFailed({
        browserSessionId: input.browserSessionId,
        requestEventId: input.event.id,
        reason: 'unsupportedSelection',
        diagnostics: [],
      });
      return;
    }
    const validation = await validateStudioFocusRequest({
      projectName: project.identity.name,
      focus: input.event.focus,
    });
    if (!validation.valid) {
      await reportStudioFocusRequestFailed({
        browserSessionId: input.browserSessionId,
        requestEventId: input.event.id,
        reason: validation.reason,
        diagnostics: validation.diagnostics,
      });
      return;
    }
    input.appliedRequestIdRef.current = input.event.id;
    input.appliedFocusRequestIdsRef.current.add(input.event.id);
    setSelection(input.event.focus.selection);
    await input.projectSessionRef.current.navigateToMovieStudioSelection(
      input.event.focus.selection
    );
  } catch {
    await reportStudioFocusRequestFailed({
      browserSessionId: input.browserSessionId,
      requestEventId: input.event.id,
      reason: 'selectionNotFound',
      diagnostics: [],
    });
  } finally {
    if (input.focusRequestInProgressRef.current === input.event.id) {
      input.focusRequestInProgressRef.current = null;
    }
  }
}

async function applyStartupPendingFocusRequest(input: {
  browserSessionId: string;
} & StudioCoordinationRefs): Promise<void> {
  const current = await readStudioCurrent();
  if (!current.pendingRequest) {
    return;
  }
  await applyFocusRequest({
    ...input,
    event: pendingRequestToFocusRequestedEvent(current.pendingRequest),
  });
}

function pendingRequestToFocusRequestedEvent(
  pendingRequest: StudioPendingRequest
): StudioFocusRequestedEvent {
  return {
    id: pendingRequest.eventId,
    type: 'studio.focusRequested',
    createdAt: pendingRequest.createdAt,
    projectRef: pendingRequest.projectRef,
    focus: pendingRequest.focus,
    refresh: pendingRequest.refresh,
  };
}

function readBrowserSessionId(): string {
  const existing = window.sessionStorage.getItem(BROWSER_SESSION_KEY);
  if (existing) {
    return existing;
  }
  const browserSessionId = `studio_browser_${crypto.randomUUID()}`;
  window.sessionStorage.setItem(BROWSER_SESSION_KEY, browserSessionId);
  return browserSessionId;
}

function toProjectRef(project: ProjectWithHttp): StudioProjectRef {
  return {
    name: project.identity.name,
    id: project.identity.id,
    storageRoot: project.identity.folderPath.slice(
      0,
      -1 * (`/${project.identity.name}`.length)
    ),
  };
}
