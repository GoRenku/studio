import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectSession } from '@/app/use-project-session';
import type { StudioSelection } from '@/features/movie-studio/movie-studio-selection';
import type { ProjectShellWithHttp } from '@/services/studio-project-contracts';
import {
  readStudioEvents,
  readStudioCurrent,
  reportBrowserSessionActive,
  reportStudioFocusChanged,
  reportStudioFocusRequestFailed,
  validateStudioFocusRequest,
} from '@/services/studio-events-api';
import { isStudioApiErrorCode } from '@/services/studio-api-errors';
import type {
  StudioBrowserSessionActivityKind,
  StudioFocus,
  StudioEvent,
  StudioFocusRequestedEvent,
  GenerationPreviewResourceRequestedEvent,
  StudioPendingRequest,
  StudioProjectRef,
} from '@/services/studio-current-contracts';
import { invalidateCastDesignResource } from '@/services/studio-project-assets-api';
import { matchesProjectShellResource } from '@/hooks/use-studio-resource-refresh';

const BROWSER_SESSION_KEY = 'renku.studio.browserSessionId';
const POLLING_INTERVAL_MS = 2_000;
const ACTIVITY_DEBOUNCE_MS = 30_000;
const VISIBLE_HEARTBEAT_MS = 60_000;

export interface StudioCoordinationSelection {
  selection: StudioSelection;
}

export function useStudioCoordination(input: {
  projectSession: ProjectSession;
  studioSelection: StudioCoordinationSelection | null;
}) {
  const { projectSession, studioSelection } = input;
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
  const [focusReportVersion, setFocusReportVersion] = useState(0);
  const projectSessionRef = useRef(projectSession);
  const currentProjectRef = useRef<ProjectShellWithHttp | null>(projectSession.project);
  const selection = studioSelection?.selection ?? null;
  const currentSelectionRef = useRef<StudioSelection | null>(selection);
  const requestFocusReportRef = useRef(() => {
    setFocusReportVersion((version) => version + 1);
  });

  useEffect(() => {
    projectSessionRef.current = projectSession;
    currentProjectRef.current = projectSession.project;
  }, [projectSession]);

  useEffect(() => {
    currentSelectionRef.current = selection;
  }, [selection]);

  const reportActivity = useCallback(async (
    activityKind: StudioBrowserSessionActivityKind,
    options: { force?: boolean } = {}
  ) => {
    const now = Date.now();
    if (!options.force && now - lastActivityRef.current < ACTIVITY_DEBOUNCE_MS) {
      return;
    }
    lastActivityRef.current = now;
    const project = currentProjectRef.current;
    const currentSelection = currentSelectionRef.current;
    const projectRef = project && currentSelection ? toProjectRef(project) : undefined;
    const focus: StudioFocus = project && currentSelection
      ? { screen: 'movieStudio', selection: currentSelection }
      : { screen: 'projectLibrary' };
    try {
      await reportBrowserSessionActive({
        browserSessionId,
        activityKind,
        projectRef,
        focus,
      });
    } catch (error) {
      handleStudioCoordinationReportError(error);
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
      currentProjectRef,
      focusRequestInProgressRef,
      appliedRequestIdRef,
      appliedFocusRequestIdsRef,
      requestFocusReportRef,
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
    void reportActivity(readDocumentActivityKind(), { force: true });
    requestPoll();
    const interval = window.setInterval(() => {
      requestPoll();
    }, POLLING_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [requestPoll, reportActivity]);

  useEffect(() => {
    const reportVisibleActivity = () => {
      if (document.visibilityState === 'visible') {
        void reportActivity(readDocumentActivityKind(), { force: true });
        requestPoll();
      }
    };
    window.addEventListener('focus', reportVisibleActivity);
    document.addEventListener('visibilitychange', reportVisibleActivity);
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void reportActivity(readDocumentActivityKind());
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
      currentProjectRef,
      focusRequestInProgressRef,
      appliedRequestIdRef,
      appliedFocusRequestIdsRef,
      requestFocusReportRef,
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
    }).catch((error) => {
      handleStudioCoordinationReportError(error);
      // Local coordination reporting should not break the Studio UI render path.
    });
  }, [
    browserSessionId,
    projectSession.isLoadingProjectRoute,
    selection,
    projectSession.project,
    focusReportVersion,
  ]);
}

function handleStudioCoordinationReportError(error: unknown): void {
  if (isStudioApiErrorCode(error, 'STUDIO_SERVER021')) {
    window.location.reload();
  }
}

interface StudioCoordinationRefs {
  projectSessionRef: { current: ProjectSession };
  currentProjectRef: { current: ProjectShellWithHttp | null };
  focusRequestInProgressRef: { current: string | null };
  appliedRequestIdRef: { current: string | null };
  appliedFocusRequestIdsRef: { current: Set<string> };
  requestFocusReportRef: { current: () => void };
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
        surface?: string;
      };
      if (refreshEvent.surface === 'projectLibrary') {
        await input.projectSessionRef.current.refreshProjectLibrary();
      }
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

    if (event.type === 'studio.projectResourcesChanged') {
      const resourceEvent = event as {
        projectRef: StudioProjectRef;
        resourceKeys: string[];
      };
      if (
        input.currentProjectRef.current?.identity.id ===
        resourceEvent.projectRef.id
      ) {
        invalidateChangedResources(resourceEvent);
        publishChangedResources(resourceEvent);
        if (matchesProjectShellResource(resourceEvent.resourceKeys)) {
          const project = await input.projectSessionRef.current.refreshProject(
            resourceEvent.projectRef.name
          );
          input.currentProjectRef.current = project;
          refreshedProjectIds.add(resourceEvent.projectRef.id);
        }
      }
    }

    if (event.type === 'studio.generationPreviewRequested') {
      const previewEvent = event as GenerationPreviewResourceRequestedEvent;
      if (
        input.currentProjectRef.current?.identity.id ===
        previewEvent.projectRef.id
      ) {
        publishGenerationPreview(previewEvent);
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
        currentProjectRef: input.currentProjectRef,
        focusRequestInProgressRef: input.focusRequestInProgressRef,
        appliedRequestIdRef: input.appliedRequestIdRef,
        appliedFocusRequestIdsRef: input.appliedFocusRequestIdsRef,
        requestFocusReportRef: input.requestFocusReportRef,
        refreshedProjectIds,
      });
    }
  }
}

function publishGenerationPreview(
  event: GenerationPreviewResourceRequestedEvent
): void {
  window.dispatchEvent(
    new CustomEvent('renku:generation-preview-requested', {
      detail: {
        projectName: event.projectRef.name,
        preview: event.preview,
        eventId: event.id,
        createdAt: event.createdAt,
      },
    })
  );
}

function invalidateChangedResources(event: {
  projectRef: StudioProjectRef;
  resourceKeys: string[];
}): void {
  for (const resourceKey of event.resourceKeys) {
    const castDesignId = castDesignResourceId(resourceKey);
    if (castDesignId) {
      invalidateCastDesignResource(event.projectRef.name, castDesignId);
    }
  }
}

function publishChangedResources(event: {
  projectRef: StudioProjectRef;
  resourceKeys: string[];
}): void {
  window.dispatchEvent(
    new CustomEvent('renku:studio-resource-changed', {
      detail: {
        projectName: event.projectRef.name,
        resourceKeys: event.resourceKeys,
      },
    })
  );
}

function castDesignResourceId(resourceKey: string): string | null {
  const surfacePrefix = 'surface:cast-design:';
  if (resourceKey.startsWith(surfacePrefix)) {
    return resourceKey.slice(surfacePrefix.length);
  }
  const assetsPrefix = 'assets:castMember:';
  if (resourceKey.startsWith(assetsPrefix)) {
    return resourceKey.slice(assetsPrefix.length);
  }
  return null;
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
    await input.projectSessionRef.current.navigateToStudioSelectionRoute(
      input.event.focus.selection,
      project.identity.name
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
    if (input.appliedRequestIdRef.current === input.event.id) {
      input.requestFocusReportRef.current();
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

function readDocumentActivityKind(): StudioBrowserSessionActivityKind {
  if (document.hasFocus()) {
    return 'focused';
  }
  if (document.visibilityState === 'visible') {
    return 'visible';
  }
  return 'heartbeat';
}

function toProjectRef(project: ProjectShellWithHttp): StudioProjectRef {
  return {
    name: project.identity.name,
    id: project.identity.id,
    storageRoot: project.identity.folderPath.slice(
      0,
      -1 * (`/${project.identity.name}`.length)
    ),
  };
}
