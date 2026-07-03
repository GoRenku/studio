import type { StudioSelection } from '@/features/movie-studio/movie-studio-selection';
import type { StudioGenerationPreview } from '@gorenku/studio-core/client';

export interface StudioProjectRef {
  name: string;
  id: string;
  storageRoot: string;
}

export type StudioBrowserSessionActivityKind =
  | 'focused'
  | 'visible'
  | 'heartbeat';

export type StudioFocus =
  | { screen: 'projectLibrary' }
  | { screen: 'movieStudio'; selection: StudioSelection };

export interface StudioEventBase {
  id: string;
  createdAt: string;
  type: string;
}

export interface StudioFocusRequestedEvent extends StudioEventBase {
  type: 'studio.focusRequested';
  projectRef?: StudioProjectRef;
  focus: StudioFocus;
  refresh?: {
    project?: boolean;
    library?: boolean;
  };
}

export interface StudioPendingRequest {
  eventId: string;
  projectRef?: StudioProjectRef;
  focus: StudioFocus;
  refresh?: {
    project?: boolean;
    library?: boolean;
  };
  createdAt: string;
}

export interface StudioProjectRefreshRequestedEvent extends StudioEventBase {
  type: 'studio.projectRefreshRequested';
  projectRef: StudioProjectRef;
  surface: 'projectInformation' | 'projectLibrary';
}

export interface StudioProjectResourcesChangedEvent extends StudioEventBase {
  type: 'studio.projectResourcesChanged';
  projectRef: StudioProjectRef;
  resourceKeys: string[];
}

export interface StudioGenerationPreviewRequestedEvent extends StudioEventBase {
  type: 'studio.generationPreviewRequested';
  projectRef: StudioProjectRef;
  preview: StudioGenerationPreview;
}

export type StudioEvent =
  | StudioFocusRequestedEvent
  | StudioProjectRefreshRequestedEvent
  | StudioProjectResourcesChangedEvent
  | StudioGenerationPreviewRequestedEvent
  | StudioEventBase;

export interface StudioEventsResponse {
  events: StudioEvent[];
  nextCursor: string;
  warnings: unknown[];
}

export interface StudioCurrentResponse {
  studio: {
    running: boolean;
  };
  project: {
    name: string;
    id: string;
    title: string;
  } | null;
  selection: StudioSelection | null;
  context: unknown | null;
  pendingRequest: StudioPendingRequest | null;
  warnings: unknown[];
}

export type StudioFocusRequestValidationResponse =
  | {
      valid: true;
    }
  | {
      valid: false;
      reason: 'selectionNotFound' | 'unsupportedSelection';
      diagnostics: unknown[];
    };

declare global {
  interface Window {
    __RENKU_STUDIO_BOOTSTRAP__?: {
      studioApiToken?: string;
    };
  }
}
