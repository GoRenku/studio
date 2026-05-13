import type {
  Asset,
  CastDesignResource,
  MovieStudioSelection,
  MovieStudioSelectionContextResult,
  PageResponse,
  ProductionExportSummary,
  ProjectLibrary,
  ProjectShell,
  ProjectSummary,
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

export type StudioPageResponse<T> = PageResponse<T>;

export type MovieStudioSelectionContextRequest = {
  selection: MovieStudioSelection;
};

export type MovieStudioSelectionContextResponse =
  MovieStudioSelectionContextResult;
