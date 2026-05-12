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
  StudioFocusRequestedEvent,
  StudioPendingRequest,
  StudioProjectRef,
} from '@/services/studio-current-contracts';

const BROWSER_SESSION_KEY = 'renku.studio.browserSessionId';
const POLLING_INTERVAL_MS = 1_000;
const ACTIVITY_DEBOUNCE_MS = 2_000;
const VISIBLE_HEARTBEAT_MS = 15_000;

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
  const lastActivityRef = useRef(0);
  const applyingRequestIdRef = useRef<string | null>(null);
  const lastReportedFocusKeyRef = useRef<string | null>(null);
  const currentProjectRef = useRef<ProjectWithHttp | null>(projectSession.project);
  const setSelection = movieStudioSelection?.setSelection ?? null;
  const selection = movieStudioSelection?.selection ?? null;

  useEffect(() => {
    currentProjectRef.current = projectSession.project;
  }, [projectSession.project]);

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

  const poll = useCallback(async () => {
    try {
      const response = await readStudioEvents(cursorRef.current);
      cursorRef.current = response.nextCursor;
      if (!hasInitializedEventCursorRef.current) {
        hasInitializedEventCursorRef.current = true;
        await applyStartupPendingFocusRequest({
          browserSessionId,
          projectSession,
          setSelection,
          applyingRequestIdRef,
        });
        return;
      }
      for (const event of response.events) {
        if (event.type === 'studio.focusRequested') {
          await applyFocusRequest({
            event: event as StudioFocusRequestedEvent,
            browserSessionId,
            projectSession,
            setSelection,
            applyingRequestIdRef,
          });
        }
        if (
          event.type === 'studio.projectRefreshRequested' &&
          currentProjectRef.current?.identity.id ===
            (event as { projectRef: StudioProjectRef }).projectRef.id
        ) {
          await projectSession.refreshProject(
            (event as { projectRef: StudioProjectRef }).projectRef.name
          );
        }
      }
    } catch {
      // Polling retries on the next tick. The API also exposes warnings for malformed history.
    }
  }, [browserSessionId, projectSession, setSelection]);

  useEffect(() => {
    void reportActivity();
    void poll();
    const interval = window.setInterval(() => {
      void poll();
    }, POLLING_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [poll, reportActivity]);

  useEffect(() => {
    const reportVisibleActivity = () => {
      if (document.visibilityState === 'visible') {
        void reportActivity();
        void poll();
      }
    };
    window.addEventListener('focus', reportVisibleActivity);
    window.addEventListener('pointerdown', reportVisibleActivity);
    window.addEventListener('keydown', reportVisibleActivity);
    document.addEventListener('visibilitychange', reportVisibleActivity);
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void reportActivity();
      }
    }, VISIBLE_HEARTBEAT_MS);
    return () => {
      window.removeEventListener('focus', reportVisibleActivity);
      window.removeEventListener('pointerdown', reportVisibleActivity);
      window.removeEventListener('keydown', reportVisibleActivity);
      document.removeEventListener('visibilitychange', reportVisibleActivity);
      window.clearInterval(heartbeat);
    };
  }, [poll, reportActivity]);

  useEffect(() => {
    if (projectSession.isLoadingProjectRoute) {
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

    const appliedRequestId = applyingRequestIdRef.current ?? undefined;
    if (!appliedRequestId && lastReportedFocusKeyRef.current === observation.focusKey) {
      return;
    }
    applyingRequestIdRef.current = null;
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

async function applyFocusRequest(input: {
  event: StudioFocusRequestedEvent;
  browserSessionId: string;
  projectSession: ProjectSession;
  setSelection: ((selection: MovieStudioSelection) => void) | null;
  applyingRequestIdRef: { current: string | null };
}): Promise<void> {
  if (input.event.focus.screen === 'projectLibrary') {
    input.applyingRequestIdRef.current = input.event.id;
    input.projectSession.returnToProjectLibrary();
    return;
  }

  try {
    let project = currentProjectFromSession(input.projectSession);
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
      project = await input.projectSession.navigateToProject(input.event.projectRef.name);
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

    if (input.event.refresh?.project) {
      project = await input.projectSession.refreshProject(input.event.projectRef.name);
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
      await input.projectSession.refreshProjectLibrary();
    }
    if (!input.setSelection) {
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
    input.applyingRequestIdRef.current = input.event.id;
    input.setSelection(input.event.focus.selection);
  } catch {
    await reportStudioFocusRequestFailed({
      browserSessionId: input.browserSessionId,
      requestEventId: input.event.id,
      reason: 'selectionNotFound',
      diagnostics: [],
    });
  }
}

async function applyStartupPendingFocusRequest(input: {
  browserSessionId: string;
  projectSession: ProjectSession;
  setSelection: ((selection: MovieStudioSelection) => void) | null;
  applyingRequestIdRef: { current: string | null };
}): Promise<void> {
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

function currentProjectFromSession(projectSession: ProjectSession): ProjectWithHttp | null {
  return projectSession.project;
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
