import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type {
  GenerationPreviewResource,
  ProjectLanguage,
  ScenePanelTab,
  StudioSelection,
} from '../../client/index.js';

export const STUDIO_COORDINATION_EVENT_VERSION = '0.1.0' as const;

export type StudioEventType =
  | 'studio.projectRefreshRequested'
  | 'studio.projectResourcesChanged'
  | 'studio.focusRequested'
  | 'studio.focusChanged'
  | 'studio.focusRequestFailed'
  | 'studio.browserSessionActive'
  | 'studio.generationPreviewsRequested';

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
  | 'synopsis'
  | 'premise'
  | 'intendedAudience'
  | 'format'
  | 'targetRuntimeMinutes'
  | 'primaryGenre'
  | 'secondaryGenres'
  | 'tones'
  | 'contentRatingIntent'
  | 'creativeBoundaries'
  | 'centralConflict'
  | 'dramaticQuestion'
  | 'themes'
  | 'historicalBasis'
  | 'dramatizedElements'
  | 'screenplayDraftStatus'
  | 'researchSources'
  | 'assumptions'
  | 'openQuestions'
  | 'nextSteps'
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

export interface StudioGenerationPreviewsRequestedEvent extends StudioEventBase {
  type: 'studio.generationPreviewsRequested';
  projectRef: StudioProjectRef;
  previews: GenerationPreviewResource[];
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

export type StudioBrowserSessionActivityKind =
  | 'focused'
  | 'visible'
  | 'heartbeat';

export interface StudioBrowserSessionActiveEvent extends StudioEventBase {
  type: 'studio.browserSessionActive';
  browserSessionId: string;
  activityKind?: StudioBrowserSessionActivityKind;
  projectRef?: StudioProjectRef;
  focus?: StudioFocus;
}

export type StudioEvent =
  | StudioProjectRefreshRequestedEvent
  | StudioProjectResourcesChangedEvent
  | StudioFocusRequestedEvent
  | StudioFocusChangedEvent
  | StudioFocusRequestFailedEvent
  | StudioBrowserSessionActiveEvent
  | StudioGenerationPreviewsRequestedEvent;

type StudioAssignedEnvelopeKeys = 'id' | 'version' | 'createdAt';

export type AppendStudioEventInput =
  | (Omit<StudioProjectRefreshRequestedEvent, StudioAssignedEnvelopeKeys> & StudioEventMetadataInput)
  | (Omit<StudioProjectResourcesChangedEvent, StudioAssignedEnvelopeKeys> & StudioEventMetadataInput)
  | (Omit<StudioFocusRequestedEvent, StudioAssignedEnvelopeKeys> & StudioEventMetadataInput)
  | (Omit<StudioFocusChangedEvent, StudioAssignedEnvelopeKeys> & StudioEventMetadataInput)
  | (Omit<StudioFocusRequestFailedEvent, StudioAssignedEnvelopeKeys> & StudioEventMetadataInput)
  | (Omit<StudioBrowserSessionActiveEvent, StudioAssignedEnvelopeKeys> & StudioEventMetadataInput)
  | (Omit<StudioGenerationPreviewsRequestedEvent, StudioAssignedEnvelopeKeys> & StudioEventMetadataInput);

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
      productionNumber?: string;
      parentSections: { id: string; type: 'act' | 'sequence'; title: string }[];
      sceneTab: StudioCurrentSceneTab;
    }
  | {
      kind: 'section';
      id: string;
      sectionType: 'act' | 'sequence';
      title: string;
      description?: string;
      scenes: { id: string; heading: string; title?: string }[];
    }
  | {
      kind: 'storyArc';
      projectTitle: string;
      sections: {
        id: string;
        type: 'act' | 'sequence';
        title: string;
      }[];
    }
  | {
      kind: 'visualLanguage';
      sections: ('inspiration' | 'lookbooks')[];
    }
  | {
      kind: 'cast';
      cast: { id: string; name: string; role?: string; description?: string }[];
    }
  | {
      kind: 'locations';
      locations: { id: string; name: string; timePeriod?: string; description?: string }[];
    }
  | {
      kind: 'props';
      props: { id: string; name: string; description?: string }[];
    }
  | {
      kind: 'prop';
      id: string;
      name: string;
      description?: string;
    };

export interface StudioCurrentSceneTab {
  id: ScenePanelTab;
  label: string;
}

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
