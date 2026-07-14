import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type {
  GenerationPreviewResource,
  ProjectLanguage,
  ScenePanelTab,
  SceneTakeWorkspaceMode,
  SceneShotDetailTab,
  CameraAngleId,
  FocusId,
  LensId,
  MoveDirectionId,
  MoveTrackId,
  RigId,
  ShotMovementId,
  ShotSizeId,
  SubjectFramingId,
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

export type StudioSelection =
  | { type: 'projectInformation' }
  | { type: 'inspiration'; folderId?: string }
  | { type: 'lookbook'; kind: 'production' | 'storyboard' }
  | { type: 'trash' }
  | { type: 'cast' }
  | { type: 'castMember'; id: string }
  | { type: 'locations' }
  | { type: 'location'; id: string }
  | { type: 'storyArc' }
  | { type: 'act'; id: string }
  | { type: 'sequence'; id: string }
  | {
      type: 'scene';
      id: string;
      sceneTab?: ScenePanelTab;
      shotId?: string;
      takeWorkspaceMode?: 'list' | 'new' | 'edit';
      takeId?: string;
      shotTab?: SceneShotDetailTab;
    };

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
      summary?: string;
      parentSequence: { id: string; number: number; title: string; summary?: string };
      sceneTab: StudioCurrentSceneTab;
      takeWorkspace?: StudioCurrentTakeWorkspace;
      shot?: StudioCurrentShotContext;
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
      sections: ('inspiration' | 'lookbooks')[];
    }
  | {
      kind: 'cast';
      cast: { id: string; name: string; role?: string; description?: string }[];
    }
  | {
      kind: 'locations';
      locations: { id: string; name: string; timePeriod?: string; description?: string }[];
    };

export interface StudioCurrentSceneTab {
  id: ScenePanelTab;
  label: string;
}

export interface StudioCurrentShotContext {
  id: string;
  index: number;
  label: string;
  title: string;
  activeTab: StudioCurrentShotTab;
  currentTabSelections: StudioCurrentShotTabSelections;
}

export interface StudioCurrentTakeWorkspace {
  mode: SceneTakeWorkspaceMode;
  takeId?: string;
  takeMode?: 'continuous' | 'multi-cut';
  sourceShotListId?: string;
  shotIds: string[];
  selectedShotId?: string;
  recommendedReadCommand?: string;
}

export interface StudioCurrentShotTab {
  id: SceneShotDetailTab;
  label: string;
}

export type StudioCurrentShotTabSelections =
  | StudioCurrentCompositionSelections
  | StudioCurrentMotionSelections
  | StudioCurrentCastSelections
  | StudioCurrentLocationSelections
  | StudioCurrentTakeSelections
  | StudioCurrentEmptyShotTabSelections;

export interface StudioCurrentSelectionLabel<Id extends string> {
  id: Id;
  label: string;
}

export interface StudioCurrentCompositionSelections {
  kind: 'composition';
  shotSize?: StudioCurrentSelectionLabel<ShotSizeId>;
  subjectFraming: StudioCurrentSelectionLabel<SubjectFramingId>[];
  cameraAngle?: StudioCurrentSelectionLabel<CameraAngleId>;
  dutch?: 'left' | 'right';
  lens?: {
    type?: StudioCurrentSelectionLabel<LensId>;
    millimeters?: number;
    focus?: StudioCurrentSelectionLabel<FocusId>;
  };
  customComposition?: string;
}

export interface StudioCurrentMotionSelections {
  kind: 'motion';
  movement?: StudioCurrentSelectionLabel<ShotMovementId>;
  secondary?: StudioCurrentSelectionLabel<ShotMovementId>;
  directions: StudioCurrentSelectionLabel<MoveDirectionId>[];
  track?: StudioCurrentSelectionLabel<MoveTrackId>;
  rig?: StudioCurrentSelectionLabel<RigId>;
  customMotion?: string;
}

export interface StudioCurrentCastSelections {
  kind: 'cast';
  cast: { id: string; name: string }[];
}

export interface StudioCurrentLocationSelections {
  kind: 'location';
  locations: { id: string; name: string }[];
}

export interface StudioCurrentTakeSelections {
  kind: 'take';
  takeId?: string;
  sourceShotListId?: string;
  shotIds: string[];
}

export interface StudioCurrentEmptyShotTabSelections {
  kind:
    | 'description'
    | 'lookbook'
    | 'dialogs'
    | 'references'
    | 'ai-production';
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
