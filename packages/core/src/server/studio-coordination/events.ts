import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { ProjectLanguage } from '../../client/index.js';

export const STUDIO_COORDINATION_EVENT_VERSION = '0.1.0' as const;

export type StudioEventType =
  | 'studio.projectRefreshRequested'
  | 'studio.projectResourcesChanged'
  | 'studio.focusRequested'
  | 'studio.focusChanged'
  | 'studio.focusRequestFailed'
  | 'studio.browserSessionActive';

export type StudioEventSource =
  | { kind: 'cli'; command: string }
  | {
      kind: 'studio';
      serverInstanceId?: string;
      browserSessionId?: string;
    }
  | { kind: 'agent'; name?: string };

export interface StudioEventBase {
  id: string;
  version: typeof STUDIO_COORDINATION_EVENT_VERSION;
  createdAt: string;
  type: StudioEventType;
  source: StudioEventSource;
  operationId?: string;
}

export interface StudioProjectRef {
  name: string;
  id: string;
  storageRoot: string;
}

export type StudioSelection =
  | { type: 'projectInformation' }
  | { type: 'visualLanguage' }
  | { type: 'cast' }
  | { type: 'castMember'; id: string }
  | { type: 'locations' }
  | { type: 'location'; id: string }
  | { type: 'storyArc' }
  | { type: 'sequence'; id: string }
  | { type: 'scene'; id: string };

export type StudioFocusRequest =
  | { screen: 'projectLibrary' }
  | { screen: 'movieStudio'; selection: StudioSelection };

export type StudioFocus = StudioFocusRequest;

export interface StudioRefreshRequest {
  project?: boolean;
  library?: boolean;
}

export type StudioProjectRefreshSurface =
  | 'projectInformation'
  | 'projectLibrary';

export type ProjectInformationRefreshField =
  | 'title'
  | 'aspectRatio'
  | 'logline'
  | 'summary'
  | 'languages';

export interface StudioProjectRefreshRequestedEvent extends StudioEventBase {
  type: 'studio.projectRefreshRequested';
  projectRef: StudioProjectRef;
  surface: StudioProjectRefreshSurface;
  changedFields?: ProjectInformationRefreshField[];
}

export interface StudioProjectResourcesChangedEvent extends StudioEventBase {
  type: 'studio.projectResourcesChanged';
  projectRef: StudioProjectRef;
  resourceKeys: string[];
}

export interface StudioFocusRequestedEvent extends StudioEventBase {
  type: 'studio.focusRequested';
  projectRef?: StudioProjectRef;
  focus: StudioFocusRequest;
  refresh?: StudioRefreshRequest;
}

export interface StudioFocusChangedEvent extends StudioEventBase {
  type: 'studio.focusChanged';
  projectRef?: StudioProjectRef;
  focus: StudioFocus;
  appliedRequestId?: string;
}

export type StudioFocusRequestFailureReason =
  | 'projectNotFound'
  | 'projectRefMismatch'
  | 'selectionNotFound'
  | 'unsupportedSelection';

export interface StudioFocusRequestFailedEvent extends StudioEventBase {
  type: 'studio.focusRequestFailed';
  requestEventId: string;
  reason: StudioFocusRequestFailureReason;
  diagnostics: DiagnosticIssue[];
}

export interface StudioBrowserSessionActiveEvent extends StudioEventBase {
  type: 'studio.browserSessionActive';
  browserSessionId: string;
}

export type StudioEvent =
  | StudioProjectRefreshRequestedEvent
  | StudioProjectResourcesChangedEvent
  | StudioFocusRequestedEvent
  | StudioFocusChangedEvent
  | StudioFocusRequestFailedEvent
  | StudioBrowserSessionActiveEvent;

type StudioAssignedEnvelopeKeys = 'id' | 'version' | 'createdAt';

export type AppendStudioEventInput =
  | (Omit<StudioProjectRefreshRequestedEvent, StudioAssignedEnvelopeKeys> & StudioEventMetadataInput)
  | (Omit<StudioProjectResourcesChangedEvent, StudioAssignedEnvelopeKeys> & StudioEventMetadataInput)
  | (Omit<StudioFocusRequestedEvent, StudioAssignedEnvelopeKeys> & StudioEventMetadataInput)
  | (Omit<StudioFocusChangedEvent, StudioAssignedEnvelopeKeys> & StudioEventMetadataInput)
  | (Omit<StudioFocusRequestFailedEvent, StudioAssignedEnvelopeKeys> & StudioEventMetadataInput)
  | (Omit<StudioBrowserSessionActiveEvent, StudioAssignedEnvelopeKeys> & StudioEventMetadataInput);

export interface StudioEventMetadataInput {
  source: StudioEventSource;
  operationId?: string;
  createdAt?: string;
}

export interface ReadStudioEventsInput {
  after?: string;
}

export interface StudioEventReadResult {
  events: StudioEvent[];
  nextCursor: string;
  warnings: DiagnosticIssue[];
}

export interface StudioCurrentProject {
  name: string;
  id: string;
  title: string;
}

export type StudioCurrentContext =
  | {
      kind: 'projectInformation';
      title: string;
      aspectRatio?: string;
      logline?: string;
      summary?: string;
      languages: ProjectLanguage[];
    }
  | {
      kind: 'castMember';
      id: string;
      name: string;
      role?: string;
      description?: string;
    }
  | {
      kind: 'location';
      id: string;
      name: string;
      timePeriod?: string;
      description?: string;
    }
  | {
      kind: 'scene';
      id: string;
      title: string;
      summary?: string;
      parentSequence: { id: string; number: number; title: string; summary?: string };
    }
  | {
      kind: 'sequence';
      id: string;
      number: number;
      title: string;
      shortTitle?: string;
      summary?: string;
      scenes: { id: string; title: string; summary?: string }[];
    }
  | {
      kind: 'storyArc';
      projectTitle: string;
      sequences: {
        id: string;
        number: number;
        title: string;
        scenes: { id: string; title: string }[];
      }[];
    }
  | {
      kind: 'visualLanguage';
      entries: { id: string; name: string; intent?: string; summary?: string }[];
    }
  | {
      kind: 'cast';
      cast: { id: string; name: string; role?: string; description?: string }[];
    }
  | {
      kind: 'locations';
      locations: { id: string; name: string; timePeriod?: string; description?: string }[];
    };

export interface StudioPendingRequest {
  eventId: string;
  projectRef?: StudioProjectRef;
  focus: StudioFocusRequest;
  refresh?: StudioRefreshRequest;
  createdAt: string;
}

export interface StudioCurrent {
  studio: {
    running: boolean;
  };
  project: StudioCurrentProject | null;
  selection: StudioSelection | null;
  context: StudioCurrentContext | null;
  pendingRequest: StudioPendingRequest | null;
  warnings: DiagnosticIssue[];
}
