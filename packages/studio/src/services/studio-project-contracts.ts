import type {
  Asset,
  CastDesignResource,
  ClipNavigationRow,
  ClipDesignResource,
  EpisodeNavigationRow,
  StudioSelection,
  StudioSelectionContextResult,
  PageResponse,
  ProductionExportSummary,
  ProjectInformationResource,
  ProjectLibrary,
  ProjectShell,
  ProjectSummary,
  SceneNavigationRow,
  SequenceNavigationRow,
} from '@gorenku/studio-core';

export type ProjectShellWithHttp = ProjectShell & {
  coverUrl: string | null;
};

export type ProjectSummaryWithHttp = ProjectSummary & {
  coverUrl: string | null;
};

export type ProjectLibraryWithHttp = Omit<ProjectLibrary, 'projects'> & {
  projects: ProjectSummaryWithHttp[];
};

export interface ProjectInformationUpdateRequest {
  title: string;
  aspectRatio?: string;
  logline?: string;
  summary?: string | null;
  languages: ProjectInformationLanguageUpdateRequest[];
}

export type ProjectInformationResourceResponse = ProjectInformationResource;

export interface ProjectInformationLanguageUpdateRequest {
  localeTag: string;
  displayName?: string;
  isBase: boolean;
  supportsAudio: boolean;
  supportsSubtitles: boolean;
}

export type ProductionExportSummaryResponse = ProductionExportSummary;

export type StudioAssetResponse = Asset;

export type CastDesignResourceResponse = CastDesignResource;

export type ClipDesignResourceResponse = ClipDesignResource;

export type StudioPageResponse<T> = PageResponse<T>;

export type SequenceNavigationPageResponse =
  StudioPageResponse<SequenceNavigationRow>;

export type EpisodeNavigationPageResponse =
  StudioPageResponse<EpisodeNavigationRow>;

export type SceneNavigationPageResponse = StudioPageResponse<SceneNavigationRow>;

export type ClipNavigationPageResponse = StudioPageResponse<ClipNavigationRow>;

export type StudioSelectionContextRequest = {
  selection: StudioSelection;
};

export type StudioSelectionContextResponse =
  StudioSelectionContextResult;
