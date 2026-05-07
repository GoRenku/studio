import type { MovieStudioSelection } from '@/features/movie-studio/movie-studio-selection';

export interface StudioProjectRef {
  name: string;
  id: string;
  storageRoot: string;
}

export type StudioFocus =
  | { screen: 'projectLibrary' }
  | { screen: 'movieStudio'; selection: MovieStudioSelection };

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

export interface StudioProjectRefreshRequestedEvent extends StudioEventBase {
  type: 'studio.projectRefreshRequested';
  projectRef: StudioProjectRef;
  surface: 'projectInformation' | 'projectLibrary';
}

export type StudioEvent =
  | StudioFocusRequestedEvent
  | StudioProjectRefreshRequestedEvent
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
  selection: MovieStudioSelection | null;
  context: unknown | null;
  pendingRequest: unknown | null;
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
